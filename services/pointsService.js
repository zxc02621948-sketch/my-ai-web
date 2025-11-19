import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { getLevelIndex } from "@/utils/pointsLevels";
import { grantLevelRewards } from "@/utils/levelRewards";

// 以 UTC 日期做每日上限
function dateKeyOf(date = new Date()) {
  const d = new Date(date.toISOString().slice(0, 10)); // yyyy-mm-ddT00:00:00.000Z
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

// Phase A 規則（可抽離到環境變數或 config）
// 注意：上傳數量上限按等級計算（LV1=5, LV2=6, ..., VIP=50/20），但積分上限固定為20分，每種類型獨立計算
const RULES = {
  upload: { points: 5, dailyCap: 20, dedupLifetime: false }, // 圖片上傳：固定+5分，每日積分上限20分（獨立）
  video_upload: { points: 10, dailyCap: 20, dedupLifetime: false }, // 影片上傳：固定+10分，每日積分上限20分（獨立）
  music_upload: { points: 10, dailyCap: 20, dedupLifetime: false }, // 音樂上傳：固定+10分，每日積分上限20分（獨立）
  like_received: { points: 1, dailyCap: 10, dedupLifetime: true },
  comment_received: { points: 1, dailyCap: 5, dedupLifetime: false },
  daily_login: { points: 5, dailyCap: 5, dedupLifetime: false }, // 每日一次，不做終身去重
  like_given: { points: 1, dailyCap: 5, dedupLifetime: true }, // 新增：按讚者每日最多 5 分 + 終身去重
};

/**
 * 安全入帳（含每日上限與去重）
 * @param {Object} opts
 * @param {string} opts.userId 入帳的目標使用者（作品作者/上傳者）
 * @param {"upload"|"like_received"|"comment_received"|"daily_login"|"like_given"} opts.type 類型
 * @param {string|null} opts.sourceId 來源 ID（圖片/留言）
 * @param {string|null} opts.actorUserId 觸發者（按讚者/留言者/上傳者）
 * @param {Object} opts.meta 其他資料
 */
export async function creditPoints({ userId, type, sourceId = null, actorUserId = null, meta = {} }) {
  await dbConnect();

  const rule = RULES[type];
  if (!rule) return { ok: false, reason: "unknown_type" };

  const today = dateKeyOf();

  // 去重條件：
  // - 若為終身去重 (like_given/like_received)，查詢不含 dateKey（防止收回再按讚洗分）
  // - 其他維持同日去重
  const dupQuery = { userId, type, sourceId, actorUserId };
  if (!rule.dedupLifetime) {
    dupQuery.dateKey = today;
  }
  const dup = await PointsTransaction.findOne(dupQuery);
  if (dup) return { ok: false, reason: rule.dedupLifetime ? "lifetime_duplicate" : "duplicate" };

  // 每日上限計算：當日已入帳總點數（同 type）
  const agg = await PointsTransaction.aggregate([
    { $match: { userId: toObjectId(userId), type, dateKey: today } },
    { $group: { _id: null, total: { $sum: "$points" } } },
  ]);
  const used = Number(agg?.[0]?.total || 0);
  const remain = Math.max(0, rule.dailyCap - used);
  if (remain <= 0) return { ok: false, reason: "cap_reached" };

  const add = Math.min(rule.points, remain);

  const tx = await PointsTransaction.create({
    userId,
    type,
    points: add,
    sourceId: sourceId || null,
    actorUserId: actorUserId || null,
    dateKey: today,
    meta,
  });

  // 獲取用戶當前積分，檢查等級提升
  const user = await User.findById(userId);
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }
  
  const oldPoints = user.pointsBalance || 0;
  const newPoints = oldPoints + add;
  
  // 使用總獲得積分計算等級（只對正數積分累積）
  const oldTotalEarned = user.totalEarnedPoints || 0;
  const newTotalEarned = oldTotalEarned + (add > 0 ? add : 0);
  const oldLevel = getLevelIndex(oldTotalEarned);
  const newLevel = getLevelIndex(newTotalEarned);
  
  // 更新積分
  user.pointsBalance = newPoints;
  user.totalEarnedPoints = newTotalEarned;
  
  // 檢查是否升級
  let levelUpRewards = null;
  if (newLevel > oldLevel) {
    // 升級了！發放獎勵
    levelUpRewards = await grantLevelRewards(user, oldLevel, newLevel);
    
    // 處理訂閱獎勵
    if (levelUpRewards.subscriptionTrial) {
      // LV6: 免費釘選播放器 30 天
      const trial = levelUpRewards.subscriptionTrial;
      const startDate = new Date();
      const expiresAt = new Date(startDate);
      expiresAt.setDate(expiresAt.getDate() + trial.duration);
      
      // 檢查是否已有 pinPlayerTest 訂閱
      const existingSub = user.subscriptions.find(s => s.type === 'pinPlayerTest' && s.isActive);
      if (!existingSub) {
        user.subscriptions.push({
          type: 'pinPlayerTest',
          startDate: startDate,
          expiresAt: expiresAt,
          isActive: true,
          monthlyCost: 0, // 免費試用
          lastRenewedAt: startDate
        });
      }
    }
    
    if (levelUpRewards.subscriptionPermanent) {
      // LV10: 永久釘選播放器
      const permanentDate = new Date('2099-12-31');
      
      const existingSub = user.subscriptions.find(s => s.type === 'pinPlayer' && s.isActive);
      
      if (existingSub) {
        // 如果已有訂閱（月租或試用），升級為永久
        if (existingSub.expiresAt <= new Date('2099-01-01')) {
          existingSub.expiresAt = permanentDate;
          existingSub.monthlyCost = 0;
          existingSub.lastRenewedAt = new Date();
        }
        // 如果已經是永久訂閱，不做任何操作
      } else {
        // 沒有訂閱，創建新的永久訂閱
        const startDate = new Date();
        user.subscriptions.push({
          type: 'pinPlayer',
          startDate: startDate,
          expiresAt: permanentDate,
          isActive: true,
          monthlyCost: 0,
          lastRenewedAt: startDate
        });
      }
    }
  }
  
  await user.save();

  return { 
    ok: true, 
    added: add, 
    txId: tx._id,
    levelUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    rewards: levelUpRewards
  };
}

function toObjectId(id) {
  try {
    const { Types } = require("mongoose");
    return new Types.ObjectId(String(id));
  } catch {
    return null;
  }
}
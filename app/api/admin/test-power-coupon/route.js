// app/api/admin/test-power-coupon/route.js
// 測試加成券功能的 API（不花費積分）

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";
import PowerCoupon from "@/models/PowerCoupon";
import { computePopScore } from "@/utils/score";
import { computeVideoPopScore } from "@/utils/scoreVideo";
import { computeMusicPopScore } from "@/utils/scoreMusic";
import { computeInitialBoostFromTop } from "@/utils/score";
import { computeVideoInitialBoostFromTop } from "@/utils/scoreVideo";
import { computeMusicInitialBoostFromTop } from "@/utils/scoreMusic";

const POP_NEW_WINDOW_HOURS = 10;

/**
 * POST: 創建測試加成券
 */
export async function POST(request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const body = await request.json();
    const { action, type, couponId, contentType, contentId } = body;

    if (action === "create") {
      // 創建測試加成券
      const expiryDate = new Date();
      if (type === "7day") {
        expiryDate.setDate(expiryDate.getDate() + 7);
      } else if (type === "30day") {
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      const powerCoupon = new PowerCoupon({
        userId: currentUser._id,
        type: type || "7day",
        quantity: 1,
        expiry: type === "rare" ? null : expiryDate,
        used: false,
        purchasePrice: 0, // 测试用，不花费积分
        purchaseMethod: "reward", // 标记为奖励
        isRare: type === "rare",
      });

      await powerCoupon.save();

      return NextResponse.json({
        success: true,
        message: "測試加成券創建成功",
        coupon: {
          id: powerCoupon._id,
          type: powerCoupon.type,
          expiry: powerCoupon.expiry,
        },
      });
    } else if (action === "use") {
      // 使用加成券
      if (!couponId || !contentType || !contentId) {
        return NextResponse.json(
          { success: false, message: "缺少必要參數" },
          { status: 400 }
        );
      }

      const coupon = await PowerCoupon.findById(couponId);
      if (!coupon) {
        return NextResponse.json(
          { success: false, message: "加成券不存在" },
          { status: 404 }
        );
      }

      if (coupon.userId.toString() !== currentUser._id.toString()) {
        return NextResponse.json(
          { success: false, message: "無權限使用此加成券" },
          { status: 403 }
        );
      }

      if (coupon.used) {
        return NextResponse.json(
          { success: false, message: "加成券已使用" },
          { status: 400 }
        );
      }

      // 根据内容类型加载模型和内容
      let ContentModel;
      let computePopScoreFn;
      let computeInitialBoostFromTopFn;

      switch (contentType) {
        case "image":
          ContentModel = Image;
          computePopScoreFn = computePopScore;
          computeInitialBoostFromTopFn = computeInitialBoostFromTop;
          break;
        case "video":
          ContentModel = Video;
          computePopScoreFn = computeVideoPopScore;
          computeInitialBoostFromTopFn = computeVideoInitialBoostFromTop;
          break;
        case "music":
          ContentModel = Music;
          computePopScoreFn = computeMusicPopScore;
          computeInitialBoostFromTopFn = computeMusicInitialBoostFromTop;
          break;
        default:
          return NextResponse.json(
            { success: false, message: "無效的內容類型" },
            { status: 400 }
          );
      }

      const content = await ContentModel.findById(contentId);
      if (!content) {
        return NextResponse.json(
          { success: false, message: "內容不存在" },
          { status: 404 }
        );
      }

      // 检查内容是否属于用户
      const isOwner =
        contentType === "image"
          ? content.user?.toString() === currentUser._id.toString() ||
            content.userId?.toString() === currentUser._id.toString()
          : content.author?.toString() === currentUser._id.toString();

      if (!isOwner) {
        return NextResponse.json(
          {
            success: false,
            message: `無權操作此${
              contentType === "image"
                ? "圖片"
                : contentType === "video"
                ? "影片"
                : "音樂"
            }`,
          },
          { status: 403 }
        );
      }

      // 检查内容是否上传超过24小时
      const createdAt = content.createdAt || content.uploadDate;
      const contentAge = Date.now() - new Date(createdAt).getTime();
      const minAge = 24 * 60 * 60 * 1000;

      if (contentAge < minAge) {
        const remainingHours = Math.ceil((minAge - contentAge) / (60 * 60 * 1000));
        return NextResponse.json(
          {
            success: false,
            message: `內容需上傳超過24小時才能使用加成券，還需等待 ${remainingHours} 小時`,
          },
          { status: 400 }
        );
      }

      // 检查24小时冷却期
      if (content.powerUsed && content.powerUsedAt) {
        const cooldownTime = 24 * 60 * 60 * 1000;
        const timeSinceLastUse = Date.now() - new Date(content.powerUsedAt).getTime();

        if (timeSinceLastUse < cooldownTime) {
          const remainingHours = Math.ceil((cooldownTime - timeSinceLastUse) / (60 * 60 * 1000));
          return NextResponse.json(
            {
              success: false,
              message: `此內容需等待 ${remainingHours} 小時後才能再次使用加成券`,
            },
            { status: 400 }
          );
        }
      }

      // 计算 initialBoost
      const maxScoreDoc = await ContentModel.findOne({}, { popScore: 1 })
        .sort({ popScore: -1 })
        .lean();
      const newInitialBoost = computeInitialBoostFromTopFn(
        maxScoreDoc?.popScore || 0
      );

      // 更新内容
      content.initialBoost = newInitialBoost;
      content.powerUsed = true;
      content.powerUsedAt = new Date();
      content.powerExpiry = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10小时后过期
      content.powerType = coupon.type;

      // 计算新分数
      const contentForScore = content.toObject ? content.toObject() : { ...content };
      contentForScore.initialBoost = newInitialBoost;
      contentForScore.powerUsed = true;
      contentForScore.powerUsedAt = content.powerUsedAt;
      contentForScore.powerExpiry = content.powerExpiry;
      contentForScore.powerType = coupon.type;

      content.popScore = computePopScoreFn(contentForScore);
      await content.save();

      // 更新加成券
      coupon.used = true;
      coupon.usedAt = new Date();
      if (contentType === "image") {
        coupon.usedOnImage = contentId; // 向后兼容
      }
      coupon.usedOnContentId = contentId;
      coupon.contentType = contentType;
      await coupon.save();

      // 更新用户的 activePowerItems
      const user = await User.findById(currentUser._id);
      if (!user.activePowerItems) {
        user.activePowerItems = [];
      }

      // 移除已经不在使用中的项目
      user.activePowerItems = user.activePowerItems.filter(
        (item) =>
          !(
            String(item.contentId) === String(contentId) &&
            item.contentType === contentType
          )
      );

      // 添加新项目
      user.activePowerItems.push({
        contentId: contentId,
        contentType: contentType,
      });

      // 向后兼容：更新 activePowerImages（如果是图片）
      if (contentType === "image") {
        if (!user.activePowerImages) {
          user.activePowerImages = [];
        }
        if (!user.activePowerImages.includes(contentId)) {
          user.activePowerImages.push(contentId);
        }
      }

      user.lastPowerUse = new Date();
      await user.save();

      return NextResponse.json({
        success: true,
        message: "加成券使用成功",
        result: {
          initialBoost: newInitialBoost,
          popScore: content.popScore,
          powerUsedAt: content.powerUsedAt,
          powerExpiry: content.powerExpiry,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "無效的操作" },
      { status: 400 }
    );
  } catch (error) {
    console.error("測試加成券錯誤:", error);
    return NextResponse.json(
      { success: false, message: error.message || "操作失敗" },
      { status: 500 }
    );
  }
}

/**
 * GET: 獲取用戶的加成券列表或驗證加成
 */
export async function GET(request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");
    const contentTitle = searchParams.get("contentTitle"); // 新增：支援標題查詢

    if (action === "list") {
      // 獲取用戶的加成券列表
      const coupons = await PowerCoupon.find({ userId: currentUser._id })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({
        success: true,
        coupons: coupons.map((coupon) => ({
          id: coupon._id,
          type: coupon.type,
          used: coupon.used,
          usedAt: coupon.usedAt,
          usedOnContentId: coupon.usedOnContentId,
          contentType: coupon.contentType,
          expiry: coupon.expiry,
          createdAt: coupon.createdAt,
        })),
      });
    } else if (action === "verify" && contentType && (contentId || contentTitle)) {
      // 驗證加成券加成（支援ID或標題查詢）
      let ContentModel;
      let computePopScoreFn;

      switch (contentType) {
        case "image":
          ContentModel = Image;
          computePopScoreFn = computePopScore;
          break;
        case "video":
          ContentModel = Video;
          computePopScoreFn = computeVideoPopScore;
          break;
        case "music":
          ContentModel = Music;
          computePopScoreFn = computeMusicPopScore;
          break;
        default:
          return NextResponse.json(
            { success: false, message: "無效的內容類型" },
            { status: 400 }
          );
      }

      // 根据ID或标题查询内容
      let content;
      if (contentId) {
        // 使用ID查询
        content = await ContentModel.findById(contentId).lean();
      } else if (contentTitle) {
        // 使用标题查询（优先返回最新的匹配项）
        const matches = await ContentModel.find({
          title: { $regex: contentTitle.trim(), $options: "i" }
        })
          .sort({ createdAt: -1 }) // 按创建时间降序，最新的在前
          .limit(1)
          .lean();
        
        if (matches.length > 0) {
          content = matches[0];
        } else {
          // 尝试模糊匹配，提供建议
          const suggestions = await ContentModel.find({
            title: { $regex: contentTitle.trim(), $options: "i" }
          })
            .select("_id title")
            .limit(5)
            .lean();

          return NextResponse.json({
            success: false,
            message: "找不到內容",
            suggestions: suggestions.map(s => ({ id: s._id, title: s.title }))
          });
        }
      }

      if (!content) {
        return NextResponse.json(
          { success: false, message: "內容不存在" },
          { status: 404 }
        );
      }

      const now = new Date();
      const effectiveCreatedAt =
        content.powerUsed &&
        content.powerUsedAt &&
        content.powerExpiry &&
        new Date(content.powerExpiry) > now
          ? new Date(content.powerUsedAt)
          : new Date(content.createdAt || content.uploadDate);

      const hoursElapsed = (now - effectiveCreatedAt) / (1000 * 60 * 60);
      const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
      const currentBoost = (content.initialBoost || 0) * boostFactor;
      const stillInWindow = hoursElapsed < POP_NEW_WINDOW_HOURS;

      // 计算实时分数
      const livePopScore = computePopScoreFn(content);

      return NextResponse.json({
        success: true,
        result: {
          title: content.title || contentId,
          createdAt: content.createdAt || content.uploadDate,
          powerUsedAt: content.powerUsedAt,
          powerExpiry: content.powerExpiry,
          effectiveCreatedAt: effectiveCreatedAt,
          hoursElapsed: parseFloat(hoursElapsed.toFixed(2)),
          boostFactor: parseFloat(boostFactor.toFixed(3)),
          currentBoost: parseFloat(currentBoost.toFixed(2)),
          initialBoost: content.initialBoost || 0,
          stillInWindow,
          popScoreDB: content.popScore || 0,
          livePopScore: parseFloat(livePopScore.toFixed(2)),
          isUsingPowerTime:
            content.powerUsed && content.powerUsedAt
              ? effectiveCreatedAt.getTime() === new Date(content.powerUsedAt).getTime()
              : false,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "無效的操作" },
      { status: 400 }
    );
  } catch (error) {
    console.error("查詢加成券錯誤:", error);
    return NextResponse.json(
      { success: false, message: error.message || "查詢失敗" },
      { status: 500 }
    );
  }
}


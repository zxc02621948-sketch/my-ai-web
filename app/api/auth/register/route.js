import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { sendVerificationEmail } from "@/lib/email";
import { getLevelIndex } from "@/utils/pointsLevels";
import { grantLevelRewards } from "@/utils/levelRewards";

export async function POST(req) {
  try {
    const {
      email,
      backupEmail = "",
      password,
      username,
      birthday,
      gender = "hidden",
      image, // ✅ 改為 image
    } = await req.json();

    if (!email || !password || !username || !birthday) {
      return NextResponse.json({ success: false, message: "缺少必要欄位" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: "Email 格式不正確" }, { status: 400 });
    }

    if (backupEmail && !emailRegex.test(backupEmail)) {
      return NextResponse.json({ success: false, message: "備用 Email 格式不正確" }, { status: 400 });
    }

    // ✅ 檢查是否已滿 18 歲
    const birthDate = new Date(birthday);
    const today = new Date();
    const age =
      today.getFullYear() - birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);

    if (age < 18) {
      return NextResponse.json({ success: false, message: "未滿 18 歲無法註冊" }, { status: 403 });
    }

    await dbConnect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ success: false, message: "此 Email 已被註冊" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = uuidv4();

    const newUser = await User.create({
      email,
      backupEmail,
      password: hashedPassword,
      username,
      birthday,
      gender,
      image, // ✅ 儲存到 image 欄位
      isVerified: false,
      verificationToken: verifyToken,
    });

    // ✅ 註冊獎勵：新用戶註冊贈送100積分
    try {
      const REGISTER_BONUS_POINTS = 100;
      const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
      
      // 檢查是否已經領取過註冊獎勵（防止重複註冊）
      const existingBonus = await PointsTransaction.findOne({
        userId: newUser._id,
        type: "register_bonus",
      });
      
      if (!existingBonus) {
        // 創建積分交易記錄
        await PointsTransaction.create({
          userId: newUser._id,
          type: "register_bonus",
          points: REGISTER_BONUS_POINTS,
          sourceId: null,
          actorUserId: null,
          dateKey: today,
          meta: {
            reason: "新用戶註冊獎勵",
            campaign: "register_bonus_2025",
          },
        });

        // 更新用戶積分
        const oldTotalEarned = newUser.totalEarnedPoints || 0;
        newUser.pointsBalance = (newUser.pointsBalance || 0) + REGISTER_BONUS_POINTS;
        newUser.totalEarnedPoints = oldTotalEarned + REGISTER_BONUS_POINTS;

        // 檢查是否升級並發放獎勵
        const oldLevel = getLevelIndex(oldTotalEarned);
        const newLevel = getLevelIndex(newUser.totalEarnedPoints);
        
        if (newLevel > oldLevel) {
          const levelUpRewards = await grantLevelRewards(newUser, oldLevel, newLevel);
          
          // 處理訂閱獎勵
          if (levelUpRewards?.subscriptionTrial) {
            const trial = levelUpRewards.subscriptionTrial;
            const startDate = new Date();
            const expiresAt = new Date(startDate);
            expiresAt.setDate(expiresAt.getDate() + trial.duration);
            
            if (!Array.isArray(newUser.subscriptions)) {
              newUser.subscriptions = [];
            }
            
            const existingSub = newUser.subscriptions.find(s => s.type === 'pinPlayerTest' && s.isActive);
            if (!existingSub) {
              newUser.subscriptions.push({
                type: 'pinPlayerTest',
                startDate: startDate,
                expiresAt: expiresAt,
                isActive: true,
                monthlyCost: 0,
                lastRenewedAt: startDate
              });
            }
          }
          
          if (levelUpRewards?.subscriptionPermanent) {
            const permanentDate = new Date('2099-12-31');
            
            if (!Array.isArray(newUser.subscriptions)) {
              newUser.subscriptions = [];
            }
            
            const existingSub = newUser.subscriptions.find(s => s.type === 'pinPlayer' && s.isActive);
            
            if (existingSub) {
              if (existingSub.expiresAt <= new Date('2099-01-01')) {
                existingSub.expiresAt = permanentDate;
                existingSub.monthlyCost = 0;
                existingSub.lastRenewedAt = new Date();
              }
            } else {
              const startDate = new Date();
              newUser.subscriptions.push({
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

        await newUser.save();
        console.log(`✅ 註冊獎勵：用戶 ${newUser._id} 獲得 ${REGISTER_BONUS_POINTS} 積分`);
      }
    } catch (bonusError) {
      // ✅ 註冊獎勵失敗不影響註冊流程，只記錄錯誤
      console.error("❌ 註冊獎勵發放失敗：", bonusError);
    }

    await sendVerificationEmail({ email, token: verifyToken });

    return NextResponse.json({ success: true, message: "註冊成功，請至信箱完成驗證" });
  } catch (error) {
    console.error("❌ 註冊失敗：", error);

    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern || {})[0];
      const msg =
        duplicatedField === "email"
          ? "此 Email 已被註冊"
          : duplicatedField === "username"
          ? "使用者名稱已存在"
          : "資料重複";

      return NextResponse.json({ success: false, message: msg }, { status: 409 });
    }

    return NextResponse.json({ success: false, message: "伺服器錯誤" }, { status: 500 });
  }
}

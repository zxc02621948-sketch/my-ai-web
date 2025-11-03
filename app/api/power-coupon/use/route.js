// app/api/power-coupon/use/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import Image from "@/models/Image";
import PowerCoupon from "@/models/PowerCoupon";
import { dbConnect } from "@/lib/db";
import { computeInitialBoostFromTop } from "@/utils/score";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    const { imageId, couponId } = await req.json();
    
    if (!imageId || !couponId) {
      return NextResponse.json({ success: false, message: "缺少必要參數" }, { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    const image = await Image.findById(imageId);
    if (!image) {
      return NextResponse.json({ success: false, message: "圖片不存在" }, { status: 404 });
    }

    // 檢查圖片是否屬於用戶
    const imageOwnerId = image.user?._id || image.user;
    if (String(imageOwnerId) !== String(currentUser._id)) {
      return NextResponse.json({ success: false, message: "無權限操作此圖片" }, { status: 403 });
    }

    const coupon = await PowerCoupon.findById(couponId);
    if (!coupon) {
      return NextResponse.json({ success: false, message: "權力券不存在" }, { status: 404 });
    }

    // 檢查權力券是否屬於用戶
    if (coupon.userId.toString() !== currentUser._id.toString()) {
      return NextResponse.json({ success: false, message: "無權限使用此權力券" }, { status: 403 });
    }

    // 檢查權力券是否已使用
    if (coupon.used) {
      return NextResponse.json({ success: false, message: "權力券已使用" }, { status: 400 });
    }

    // 檢查權力券是否過期
    if (coupon.expiry && new Date() > new Date(coupon.expiry)) {
      return NextResponse.json({ success: false, message: "權力券已過期" }, { status: 400 });
    }

    // 檢查硬規則：最多3張圖片同時使用權力券
    if (user.activePowerImages.length >= 3) {
      return NextResponse.json({ 
        success: false, 
        message: "同時最多只能有3張圖片使用權力券" 
      }, { status: 400 });
    }

    // 檢查硬規則：同一張圖片24小時冷卻期
    if (image.powerUsed && image.powerUsedAt) {
      const cooldownTime = 24 * 60 * 60 * 1000; // 24小時
      const timeSinceLastUse = Date.now() - new Date(image.powerUsedAt).getTime();
      
      if (timeSinceLastUse < cooldownTime) {
        const remainingHours = Math.ceil((cooldownTime - timeSinceLastUse) / (60 * 60 * 1000));
        return NextResponse.json({ 
          success: false, 
          message: `此圖片需等待 ${remainingHours} 小時後才能再次使用權力券` 
        }, { status: 400 });
      }
    }

    // 檢查硬規則：圖片需上傳超過24小時
    const imageAge = Date.now() - new Date(image.createdAt).getTime();
    const minAge = 24 * 60 * 60 * 1000; // 24小時
    
    if (imageAge < minAge) {
      const remainingHours = Math.ceil((minAge - imageAge) / (60 * 60 * 1000));
      return NextResponse.json({ 
        success: false, 
        message: `圖片需上傳超過24小時才能使用權力券，還需等待 ${remainingHours} 小時` 
      }, { status: 400 });
    }

    // 重新計算 initialBoost
    const maxScore = await Image.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
    const newInitialBoost = computeInitialBoostFromTop(maxScore?.popScore || 0);

    console.log("權力券類型:", coupon.type);
    console.log("權力券類型驗證:", ['7day', '30day', 'rare'].includes(coupon.type));

    // 更新圖片
    image.initialBoost = newInitialBoost;
    image.powerUsed = true;
    image.powerUsedAt = new Date();
    image.powerExpiry = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10小時後過期
    // 保存原始權力券類型
    image.powerType = coupon.type; // 直接保存 '7day', '30day', 'rare'
    image.popScore = image.clicks * 1.0 + image.likesCount * 8.0 + image.completenessScore * 0.25 + newInitialBoost;
    
    await image.save();
    
    console.log("權力券使用後圖片數據:", {
      imageId: image._id,
      powerUsed: image.powerUsed,
      powerExpiry: image.powerExpiry,
      powerType: image.powerType,
      initialBoost: image.initialBoost
    });

    // 更新權力券
    coupon.used = true;
    coupon.usedAt = new Date();
    coupon.usedOnImage = image._id;
    
    await coupon.save();

    // 更新用戶
    user.activePowerImages.push(image._id);
    user.lastPowerUse = new Date();
    
    await user.save();

    return NextResponse.json({
      success: true,
      message: "權力券使用成功",
      data: {
        imageId: image._id,
        newInitialBoost: newInitialBoost,
        powerExpiry: image.powerExpiry,
        activePowerImages: user.activePowerImages.length
      }
    });

  } catch (error) {
    console.error("權力券使用錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}

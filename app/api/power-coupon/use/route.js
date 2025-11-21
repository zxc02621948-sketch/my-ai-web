// app/api/power-coupon/use/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";
import PowerCoupon from "@/models/PowerCoupon";
import { dbConnect } from "@/lib/db";
import { computeInitialBoostFromTop } from "@/utils/score";
import { computeVideoInitialBoostFromTop } from "@/utils/scoreVideo";
import { computeMusicInitialBoostFromTop } from "@/utils/scoreMusic";
import { computePopScore } from "@/utils/score";
import { computeVideoPopScore } from "@/utils/scoreVideo";
import { computeMusicPopScore } from "@/utils/scoreMusic";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    // 支持新的 contentType + contentId 和旧的 imageId（向后兼容）
    const { contentType, contentId, couponId, imageId } = await req.json();
    
    // 向后兼容：如果没有 contentType，使用 imageId
    const finalContentType = contentType || (imageId ? 'image' : null);
    const finalContentId = contentId || imageId;
    
    if (!finalContentType || !finalContentId || !couponId) {
      return NextResponse.json({ success: false, message: "缺少必要參數" }, { status: 400 });
    }

    if (!['image', 'video', 'music'].includes(finalContentType)) {
      return NextResponse.json({ success: false, message: "無效的內容類型" }, { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    // 根據類型載入對應的 Model
    let contentModel;
    let content;
    switch (finalContentType) {
      case 'image':
        contentModel = Image;
        content = await Image.findById(finalContentId);
        break;
      case 'video':
        contentModel = Video;
        content = await Video.findById(finalContentId);
        break;
      case 'music':
        contentModel = Music;
        content = await Music.findById(finalContentId);
        break;
      default:
        return NextResponse.json({ success: false, message: "無效的內容類型" }, { status: 400 });
    }

    if (!content) {
      const contentTypeNames = {
        image: '圖片',
        video: '影片',
        music: '音樂'
      };
      return NextResponse.json({ 
        success: false, 
        message: `${contentTypeNames[finalContentType]}不存在` 
      }, { status: 404 });
    }

    // 檢查內容是否屬於用戶（根據內容類型使用不同的字段）
    let contentOwnerId;
    switch (finalContentType) {
      case 'image':
        // Image 使用 user 或 userId
        contentOwnerId = content.user?._id || content.user || content.userId;
        break;
      case 'video':
      case 'music':
        // Video 和 Music 使用 author
        contentOwnerId = content.author?._id || content.author;
        break;
      default:
        contentOwnerId = null;
    }
    
    if (!contentOwnerId || String(contentOwnerId) !== String(currentUser._id)) {
      return NextResponse.json({ success: false, message: "無權限操作此內容" }, { status: 403 });
    }

    const coupon = await PowerCoupon.findById(couponId);
    if (!coupon) {
      return NextResponse.json({ success: false, message: "加成券不存在" }, { status: 404 });
    }

    // 檢查加成券是否屬於用戶
    if (coupon.userId.toString() !== currentUser._id.toString()) {
      return NextResponse.json({ success: false, message: "無權限使用此加成券" }, { status: 403 });
    }

    // 檢查加成券是否已使用
    if (coupon.used) {
      return NextResponse.json({ success: false, message: "加成券已使用" }, { status: 400 });
    }

    // 檢查加成券是否過期
    if (coupon.expiry && new Date() > new Date(coupon.expiry)) {
      return NextResponse.json({ success: false, message: "加成券已過期" }, { status: 400 });
    }

    // 檢查硬規則：最多3個內容同時使用加成券（圖片+影片+音樂合計）
    const activePowerItems = user.activePowerItems || [];
    if (activePowerItems.length >= 3) {
      return NextResponse.json({ 
        success: false, 
        message: "同時最多只能有3個內容使用加成券（圖片、影片、音樂合計）" 
      }, { status: 400 });
    }

    // 檢查硬規則：同一內容24小時冷卻期
    if (content.powerUsed && content.powerUsedAt) {
      const cooldownTime = 24 * 60 * 60 * 1000; // 24小時
      const timeSinceLastUse = Date.now() - new Date(content.powerUsedAt).getTime();
      
      if (timeSinceLastUse < cooldownTime) {
        const remainingHours = Math.ceil((cooldownTime - timeSinceLastUse) / (60 * 60 * 1000));
        const contentTypeNames = {
          image: '圖片',
          video: '影片',
          music: '音樂'
        };
        return NextResponse.json({ 
          success: false, 
          message: `此${contentTypeNames[finalContentType]}需等待 ${remainingHours} 小時後才能再次使用加成券` 
        }, { status: 400 });
      }
    }

    // 檢查硬規則：內容需上傳超過24小時
    const createdAt = content.createdAt || content.uploadDate;
    const contentAge = Date.now() - new Date(createdAt).getTime();
    const minAge = 24 * 60 * 60 * 1000; // 24小時
    
    if (contentAge < minAge) {
      const remainingHours = Math.ceil((minAge - contentAge) / (60 * 60 * 1000));
      const contentTypeNames = {
        image: '圖片',
        video: '影片',
        music: '音樂'
      };
      return NextResponse.json({ 
        success: false, 
        message: `${contentTypeNames[finalContentType]}需上傳超過24小時才能使用加成券，還需等待 ${remainingHours} 小時` 
      }, { status: 400 });
    }

    // 根據內容類型計算 initialBoost
    let newInitialBoost;
    switch (finalContentType) {
      case 'image': {
        const maxScore = await Image.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
        newInitialBoost = computeInitialBoostFromTop(maxScore?.popScore || 0);
        break;
      }
      case 'video': {
        const maxScore = await Video.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
        newInitialBoost = computeVideoInitialBoostFromTop(maxScore?.popScore || 0);
        break;
      }
      case 'music': {
        const maxScore = await Music.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
        newInitialBoost = computeMusicInitialBoostFromTop(maxScore?.popScore || 0);
        break;
      }
    }

    // 更新內容
    content.initialBoost = newInitialBoost;
    content.powerUsed = true;
    content.powerUsedAt = new Date();
    content.powerExpiry = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10小時後過期
    content.powerType = coupon.type; // 直接保存 '7day', '30day', 'rare'

    // 修復無效的 rating 值（根據內容類型使用不同的有效值和默認值）
    let validRatings;
    let defaultRating;
    switch (finalContentType) {
      case 'image':
      case 'video':
        // Image 和 Video 使用相同的 rating 系統
        validRatings = ["sfw", "15", "18"];
        defaultRating = "sfw";
        break;
      case 'music':
        // Music 使用不同的 rating 系統
        validRatings = ["all", "15", "18"];
        defaultRating = "all";
        break;
      default:
        validRatings = [];
        defaultRating = null;
    }
    
    if (defaultRating && content.rating && !validRatings.includes(content.rating)) {
      console.warn(`修復無效的 rating 值 (${finalContentType}): ${content.rating} -> ${defaultRating}`);
      content.rating = defaultRating;
    }

    // 確保 powerType 是有效的（如果設置了的話）
    const validPowerTypes = ['7day', '30day', 'rare'];
    if (coupon.type && !validPowerTypes.includes(coupon.type)) {
      console.warn(`警告：加成券類型無效: ${coupon.type}，跳過設置 powerType`);
      content.powerType = null;
    }
    
    // 確保 status 是有效的（如果有的話）
    if (finalContentType === 'video' || finalContentType === 'music') {
      const validStatuses = ['active', 'cold', 'archived', 'deleted'];
      if (content.status && !validStatuses.includes(content.status)) {
        console.warn(`修復無效的 status 值 (${finalContentType}): ${content.status} -> active`);
        content.status = 'active';
      }
    }

    // 重新計算 popScore（將 Mongoose 文檔轉換為普通對象以確保所有字段可訪問）
    const contentForScore = content.toObject ? content.toObject() : { ...content };
    // 確保所有字段都包含在內
    contentForScore.initialBoost = newInitialBoost;
    contentForScore.powerUsed = true;
    contentForScore.powerUsedAt = content.powerUsedAt;
    contentForScore.powerExpiry = content.powerExpiry;
    contentForScore.powerType = coupon.type;
    
    switch (finalContentType) {
      case 'image':
        content.popScore = computePopScore(contentForScore);
        break;
      case 'video':
        content.popScore = computeVideoPopScore(contentForScore);
        break;
      case 'music':
        content.popScore = computeMusicPopScore(contentForScore);
        break;
    }
    
    await content.save();

    // 更新加成券
    coupon.used = true;
    coupon.usedAt = new Date();
    coupon.usedOnImage = finalContentType === 'image' ? finalContentId : coupon.usedOnImage; // 向后兼容
    coupon.usedOnContentId = finalContentId;
    coupon.contentType = finalContentType;
    
    await coupon.save();

    // 更新用戶的 activePowerItems（移除舊的并添加新的）
    if (!user.activePowerItems) {
      user.activePowerItems = [];
    }
    
    // 移除已經不在使用中的項目（過期的）
    user.activePowerItems = user.activePowerItems.filter(item => {
      // 如果項目是當前的，先不移除（後面會更新）
      if (String(item.contentId) === String(finalContentId) && item.contentType === finalContentType) {
        return false;
      }
      // 保留其他項目（我們不驗證它們是否真的還在使用中，這可以在其他地方清理）
      return true;
    });

    // 添加新的項目
    user.activePowerItems.push({
      contentId: finalContentId,
      contentType: finalContentType
    });

    // 向后兼容：更新 activePowerImages（如果是圖片）
    if (finalContentType === 'image') {
      if (!user.activePowerImages) {
        user.activePowerImages = [];
      }
      if (!user.activePowerImages.includes(finalContentId)) {
        user.activePowerImages.push(finalContentId);
      }
    }

    user.lastPowerUse = new Date();
    
    await user.save();

    const contentTypeNames = {
      image: '圖片',
      video: '影片',
      music: '音樂'
    };

    return NextResponse.json({
      success: true,
      message: "加成券使用成功",
      data: {
        contentType: finalContentType,
        contentId: finalContentId,
        newInitialBoost: newInitialBoost,
        powerExpiry: content.powerExpiry,
        activePowerItems: user.activePowerItems.length
      }
    });

  } catch (error) {
    console.error("加成券使用錯誤:", error);
    console.error("錯誤堆疊:", error.stack);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

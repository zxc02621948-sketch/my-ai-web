// app/api/cloudflare-images/route.js
import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";
import Image from "@/models/Image";
import User from "@/models/User";
import { Notification } from "@/models/Notification";
import mongoose from "mongoose";
import { computeCompleteness } from "@/utils/score"; // 👈 新增
import { creditPoints } from "@/services/pointsService";
import { getDailyUploadLimit } from "@/utils/pointsLevels";

// === GET: 列表（也可讓詳情頁取用單筆資料） ===
export async function GET(req) {
  try {
    await dbConnect(); // 改用 dbConnect()

    const page = parseInt(req.nextUrl.searchParams.get("page")) || 1;
    const limit = parseInt(req.nextUrl.searchParams.get("limit")) || 20;
    const skip = (page - 1) * limit;

    const totalImages = await Image.countDocuments();

    const rawImages = await Image.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username image");

    const images = rawImages.map((img) => {
      const populatedUser = img.user && typeof img.user === "object" ? img.user : null;
      const fallbackImageId = "a607f9aa-b1e5-484c-bee3-02191abee13e";
      const userImage =
        populatedUser?.image && populatedUser.image.trim() !== ""
          ? populatedUser.image
          : fallbackImageId;

      return {
        _id: img._id?.toString(),
        id: img.imageId,
        title: img.title,
        imageId: img.imageId,
        imageUrl: img.imageUrl,
        originalImageId: img.originalImageId || "",
        originalImageUrl: img.originalImageUrl || "",
        platform: img.platform || "",
        positivePrompt: img.positivePrompt || "",
        negativePrompt: img.negativePrompt || "",
        rating: img.rating,
        category: img.category,
        description: img.description || "",
        tags: Array.isArray(img.tags) ? img.tags : [],

        // 模型/LoRA
        modelName: img.modelName || null,
        modelLink: img.modelLink || null,
        loraName: img.loraName || null,
        loraLink: img.loraLink || null,
        modelRef: img.modelRef || null,
        loraHashes: Array.isArray(img.loraHashes) ? img.loraHashes : [],
        loraRefs: Array.isArray(img.loraRefs) ? img.loraRefs : [],

        // 進階參數
        steps: img.steps ?? null,
        sampler: img.sampler || null,
        cfgScale: img.cfgScale ?? null,
        seed: img.seed || null,
        clipSkip: img.clipSkip ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        modelHash: img.modelHash || null,

        // ✅ 關鍵：把 Comfy 原始 JSON 一併回傳（詳情卡片要用）
        comfy: img.comfy || { workflowRaw: "", promptRaw: "" },
        raw: {
          ...(img.raw || {}),
          comfyWorkflowJson: img?.raw?.comfyWorkflowJson || "",
        },

        // 其他
        completenessScore: img.completenessScore ?? null, // 顯示用
        hasMetadata: img.hasMetadata ?? false, // ✅ 作品展示/創作參考篩選字段
        user: populatedUser
          ? {
              _id: populatedUser._id?.toString(),
              username: populatedUser.username || "未命名用戶",
              image: userImage,
            }
          : null,
        createdAt: img.createdAt,
        likes: Array.isArray(img.likes)
          ? img.likes
              .filter((id) => id && typeof id.toString === "function")
              .map((id) => id.toString())
          : [],
      };
    });

    return NextResponse.json({
      images,
      totalPages: Math.ceil(totalImages / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("讀取圖片資料錯誤：", error);
    return NextResponse.json({ message: "讀取圖片資料失敗" }, { status: 500 });
  }
}

// === POST: 建立作品（上傳後寫入資料） ===
export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      title,
      imageId,
      platform,
      positivePrompt,
      negativePrompt,
      rating,
      category,
      categories,
      description,
      tags,
      userId,
      modelName,
      loraName,
      modelLink,
      loraLink,
      steps,
      sampler,
      cfgScale,
      seed,
      clipSkip,
      width,
      height,
      modelHash,
      author,
      username, // 👈 新增接收
      comfy, // ✅ 新增
      modelRef,
      loraHashes,
      loraRefs,
      originalImageId,
      originalImageUrl,
    } = body;

    const rawRating = typeof rating === "string" ? rating.trim().toLowerCase() : "";
    const normalizedRating =
      rawRating === "18"
        ? "18"
        : rawRating === "15"
          ? "15"
          : rawRating === "sfw" || rawRating === "all" || rawRating === "general"
            ? "sfw"
            : "";

    // 验证必填字段
    if (!imageId || !title || !title.trim()) {
      return NextResponse.json({ message: "缺少图片 ID 或标题" }, { status: 400 });
    }
    
    // 验证分类：优先使用 categories 数组，否则使用单个 category（向后兼容）
    const categoriesArray = Array.isArray(categories) && categories.length > 0 
      ? categories.filter(c => c && typeof c === 'string' && c.trim())
      : (category && typeof category === 'string' && category.trim() ? [category.trim()] : []);
    
    if (categoriesArray.length === 0) {
      return NextResponse.json({ message: "請選擇至少一個分類（最多3個）" }, { status: 400 });
    }
    
    if (categoriesArray.length > 3) {
      return NextResponse.json({ message: "最多只能選擇3個分類" }, { status: 400 });
    }
    
    // 使用第一个分类作为主分类（向后兼容）
    const primaryCategory = categoriesArray[0];
    
    if (!normalizedRating) {
      return NextResponse.json({ message: "请选择有效的分级" }, { status: 400 });
    }
    
    // 验证 18+ 图片的成年声明
    if (normalizedRating === '18' && !body.adultDeclaration) {
      return NextResponse.json({ message: "18+ 图片必须勾选成年声明" }, { status: 400 });
    }

    // ✅ 檢查每日上傳限制（與等級掛鉤）
    if (userId) {
      const user = await User.findById(userId).select('totalEarnedPoints subscriptions').lean();
      if (user) {
        const totalEarnedPoints = user.totalEarnedPoints || 0;
        const baseDailyLimit = getDailyUploadLimit(totalEarnedPoints); // 基礎配額（按等級計算：LV1=5, LV2=6, ...）
        
        // ✅ 檢查 VIP 狀態（VIP 用戶有 20 張/天配額）
        const hasVIP = user.subscriptions?.some(
          sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
        );
        const finalDailyLimit = hasVIP ? 20 : baseDailyLimit;
        
        // 計算今日已上傳圖片數量
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayUploads = await Image.countDocuments({
          userId: userId,
          createdAt: {
            $gte: today,
            $lt: tomorrow
          }
        });
        
        if (todayUploads >= finalDailyLimit) {
          return NextResponse.json({ 
            message: `今日上傳限制為 ${finalDailyLimit} 張，請明天再試` 
          }, { status: 429 });
        }
      }
    }
    
    // 验证尺寸（如果提供）
    if (width !== undefined && width !== null) {
      const w = Number(width);
      if (!Number.isFinite(w) || w <= 0 || w > 20000) {
        return NextResponse.json({ message: "图片宽度无效（必须是 1-20000 之间的数字）" }, { status: 400 });
      }
    }
    
    if (height !== undefined && height !== null) {
      const h = Number(height);
      if (!Number.isFinite(h) || h <= 0 || h > 20000) {
        return NextResponse.json({ message: "图片高度无效（必须是 1-20000 之间的数字）" }, { status: 400 });
      }
    }

    const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

    // ✅ 判斷是否有元數據（用於「作品展示」vs「創作參考」篩選）
    const hasMetadata = !!(
      positivePrompt?.trim() ||
      negativePrompt?.trim() ||
      modelName?.trim() ||
      sampler?.trim() ||
      seed ||
      steps ||
      cfgScale ||
      width ||
      height
    );

    // 先組資料（空值不塞）
    console.log("💾 保存圖片到數據庫:", {
      imageId,
      imageUrl,
      originalImageId,
      originalImageUrl,
      hasOriginalImageUrl: !!originalImageUrl,
    });

    // ✅ 確保 originalImageUrl 優先使用傳入的值，不要被 imageUrl 覆蓋
    const finalOriginalImageUrl = originalImageUrl && originalImageUrl.trim() !== "" 
      ? originalImageUrl 
      : imageUrl;
    
    console.log("💾 最終保存的 originalImageUrl:", {
      receivedOriginalImageUrl: originalImageUrl,
      finalOriginalImageUrl,
      isR2: finalOriginalImageUrl.includes('media.aicreateaworld.com'),
      imageUrl,
    });

    const doc = {
      title,
      imageId,
      imageUrl,
      originalImageId: originalImageId || imageId,
      // ✅ 優先使用 R2 原圖 URL，如果沒有則回退到 Cloudflare Images URL
      originalImageUrl: finalOriginalImageUrl,
      platform: platform || "",
      positivePrompt: positivePrompt || "",
      negativePrompt: negativePrompt || "",
      rating: normalizedRating,
      category: primaryCategory, // 保持向后兼容
      categories: categoriesArray, // 新的多选分类
      description: description || "",
      tags: Array.isArray(tags) ? tags : [],
      author: author || "",
      modelName: modelName || "",
      loraName: loraName || "",
      modelLink: modelLink || "",
      loraLink: loraLink || "",
      steps: steps ?? null,
      sampler: sampler || "",
      cfgScale: cfgScale ?? null,
      seed: seed ? String(seed) : "",
      clipSkip: clipSkip ?? null,
      width: width ?? null,
      height: height ?? null,
      modelHash: modelHash || "",
      userId,
      user: userId,
      username: username || "", // 若 schema 有支援就能存
      hasMetadata, // ✅ 自動標記

      // 參考資訊
      ...(modelRef ? { modelRef } : {}),
      ...(Array.isArray(loraHashes) && loraHashes.length ? { loraHashes } : {}),
      ...(Array.isArray(loraRefs) && loraRefs.length ? { loraRefs } : {}),

      // ✅ 新：存 Comfy block
      comfy: comfy || undefined,

      // ✅ 舊欄位相容：同步 workflowRaw 一份到 raw.comfyWorkflowJson
      raw: {
        comfyWorkflowJson: comfy?.workflowRaw || undefined,
      },
    };

    // 👇 即時計算完整度，讓熱門度立即生效
    doc.completenessScore = computeCompleteness(doc);

    // ✅ 驗證保存前的數據
    console.log("📋 保存前的 doc 對象:", {
      hasOriginalImageUrl: !!doc.originalImageUrl,
      originalImageUrl: doc.originalImageUrl,
      originalImageId: doc.originalImageId,
      imageUrl: doc.imageUrl,
      imageId: doc.imageId,
      docKeys: Object.keys(doc).filter(k => k.includes('original') || k.includes('image')),
    });

    // ✅ 創建一個深拷貝，確保 originalImageUrl 不會被修改
    const docToInsert = JSON.parse(JSON.stringify(doc));
    console.log("📋 準備插入的 docToInsert:", {
      hasOriginalImageUrl: !!docToInsert.originalImageUrl,
      originalImageUrl: docToInsert.originalImageUrl,
      docToInsertKeys: Object.keys(docToInsert).filter(k => k.includes('original') || k.includes('image')),
    });

    // ✅ 先使用原生 MongoDB 直接插入，確保 originalImageUrl 被保存
    const insertResult = await Image.collection.insertOne(docToInsert);
    console.log("📝 原生 MongoDB insertOne 結果:", {
      insertedId: insertResult.insertedId,
      acknowledged: insertResult.acknowledged,
    });
    
    // ✅ 驗證插入後的原始文檔
    const rawDocAfterInsert = await Image.collection.findOne({ _id: insertResult.insertedId });
    console.log("🔍 插入後原始文檔:", {
      hasOriginalImageUrl: !!rawDocAfterInsert?.originalImageUrl,
      originalImageUrl: rawDocAfterInsert?.originalImageUrl,
      allImageKeys: Object.keys(rawDocAfterInsert || {}).filter(k => k.includes('original') || k.includes('image')),
    });
    
    // ✅ 如果 originalImageUrl 在插入後丟失，立即更新
    if (!rawDocAfterInsert?.originalImageUrl && finalOriginalImageUrl) {
      console.log("⚠️ 插入後 originalImageUrl 丟失，立即更新...");
      const updateResult = await Image.collection.updateOne(
        { _id: insertResult.insertedId },
        { $set: { originalImageUrl: finalOriginalImageUrl } }
      );
      console.log("📝 更新結果:", {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged,
      });
    }
    
    // ✅ 重新讀取以觸發 Mongoose hooks（計算分數等）
    const newImage = await Image.findById(insertResult.insertedId);
    
    // ✅ 如果 Mongoose 讀取的 originalImageUrl 丟失，從原生 MongoDB 補回
    if (!newImage.originalImageUrl && finalOriginalImageUrl) {
      const rawDoc = await Image.collection.findOne({ _id: insertResult.insertedId });
      if (rawDoc?.originalImageUrl) {
        newImage.originalImageUrl = rawDoc.originalImageUrl;
        console.log("🔧 從原生 MongoDB 補回 originalImageUrl 到 Mongoose 文檔:", newImage.originalImageUrl);
      }
    }
    
    // ✅ 因為使用了 insertOne 繞過了 pre-save hook，需要手動計算 initialBoost 和 popScore
    const { ensureLikesCount, computePopScore, POP_NEW_BASE_RATIO } = await import("@/utils/score");
    
    // 計算 initialBoost（基於當前最高分）
    const maxPopScore = await Image.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
    const maxScore = Number.isFinite(maxPopScore?.popScore) ? maxPopScore.popScore : 0;
    newImage.initialBoost = Math.max(0, Math.floor(maxScore * POP_NEW_BASE_RATIO));
    
    // 確保 likesCount 正確
    newImage.likesCount = ensureLikesCount(newImage);
    
    // 計算 popScore
    newImage.popScore = computePopScore(newImage);
    
    console.log("📊 計算新圖片分數:", {
      initialBoost: newImage.initialBoost,
      popScore: newImage.popScore,
      likesCount: newImage.likesCount,
      maxScore,
    });
    
    // 保存分數（使用 save 會觸發其他 hooks，但不會重複計算 initialBoost，因為 isNew 已經是 false）
    await newImage.save();
    
    // ✅ 驗證保存後的數據
    console.log("✅ 圖片已保存到數據庫:", {
      imageId: newImage._id,
      savedOriginalImageUrl: newImage.originalImageUrl,
      savedOriginalImageId: newImage.originalImageId,
      savedImageUrl: newImage.imageUrl,
      isR2: newImage.originalImageUrl?.includes('media.aicreateaworld.com'),
    });
    
    // ✅ 如果保存後 originalImageUrl 丟失或與 imageUrl 相同，立即使用原生 MongoDB 更新
    if ((!newImage.originalImageUrl || newImage.originalImageUrl === newImage.imageUrl) && finalOriginalImageUrl && finalOriginalImageUrl !== newImage.imageUrl) {
      console.log("⚠️ 檢測到 originalImageUrl 丟失或與 imageUrl 相同，立即更新...");
      // ✅ 使用原生 MongoDB collection 直接更新，完全繞過 Mongoose
      const updateResult = await Image.collection.updateOne(
        { _id: newImage._id },
        { $set: { originalImageUrl: finalOriginalImageUrl } }
      );
      console.log("📝 原生 MongoDB updateOne 結果:", {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
        acknowledged: updateResult.acknowledged,
      });
      // ✅ 重新讀取以確認更新成功（使用原生查詢）
      const rawDoc = await Image.collection.findOne({ _id: newImage._id });
      console.log("✅ 已更新 originalImageUrl:", {
        requested: finalOriginalImageUrl,
        dbValue: rawDoc?.originalImageUrl,
        dbValueType: typeof rawDoc?.originalImageUrl,
        isR2: rawDoc?.originalImageUrl?.includes('media.aicreateaworld.com'),
        matches: rawDoc?.originalImageUrl === finalOriginalImageUrl,
        allImageKeys: Object.keys(rawDoc || {}).filter(k => k.includes('original') || k.includes('image')),
      });
    }

    // ✅ 積分：上傳成功入帳 +5（每日上限 20）
    try {
      if (userId) {
        await creditPoints({ userId, type: "upload", sourceId: newImage._id, actorUserId: userId, meta: { imageId: newImage._id } });
      }
    } catch (e) {
      console.warn("[points] 上傳入帳失敗：", e);
    }

    // 通知追蹤者（維持原有行為）
    const followers = await User.find({ "following.userId": new mongoose.Types.ObjectId(userId) });
    const uploader = await User.findById(userId);

    await Promise.all(
      followers.map((follower) =>
        Notification.create({
          userId: follower._id,
          fromUserId: uploader?._id,
          type: "new_image",
          text: `${uploader?.username || "用戶"} 發布了新圖片《${title}》`,
          imageId: newImage._id,
          isRead: false,
        })
      )
    );

    return NextResponse.json({ message: "圖片資料已儲存", insertedId: newImage._id });
  } catch (error) {
    console.error("寫入圖片資料錯誤：", error);
    return NextResponse.json({ message: "寫入圖片資料失敗" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { computeMusicCompleteness } from "@/utils/scoreMusic";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";

// 工具函數
function normalizeTags(input) {
  const raw = Array.isArray(input) ? input.join(" ") : String(input || "");
  return raw
    .split(/[\s,，、]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toNumOrNull(v) {
  if (v === "" || v === null || typeof v === "undefined") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 允許的可更新欄位
const allowedFields = [
  "title",
  "description",
  "tags",
  "category",
  "rating",
  "platform",
  "prompt",
  "modelName",
  "modelLink",
  "genre",
  "language",
  "mood",
  "tempo",
  "key",
  "lyrics",
  "singerGender",
  "seed",
  "excludeStyles",
  "styleInfluence",
  "weirdness",
];

export async function PATCH(req, { params }) {
  try {
    await dbConnect();

    // 取得並驗證參數
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "無效的音樂 ID" },
        { status: 400 }
      );
    }

    // 權限：必須登入
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: "請先登入" },
        { status: 401 }
      );
    }

    // 解析 body（支持 JSON 和 FormData）
    let body = {};
    let isFormData = false;
    let coverFile = null;
    let coverPosition = null;
    
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        // FormData 請求（有封面文件時）
        isFormData = true;
        const formData = await req.formData();
        
        // 提取所有表單欄位
        // 先處理 genres 陣列（使用 getAll 獲取所有值）
        const genresArray = formData.getAll("genre").filter((g) => g);
        if (genresArray.length > 0) {
          body.genre = genresArray;
        }
        
        // 然後處理其他欄位
        for (const [key, value] of formData.entries()) {
          if (key === "cover" && value instanceof File) {
            coverFile = value;
          } else if (key === "coverPosition") {
            coverPosition = value;
          } else if (key !== "genre") {
            // 跳過 genre，因為已經處理過了
            body[key] = value;
          }
        }
      } else {
        // JSON 請求
        body = await req.json();
      }
    } catch (error) {
      return NextResponse.json(
        { ok: false, message: "請提供有效的請求內容" },
        { status: 400 }
      );
    }

    // 取得音樂
    const music = await Music.findById(id);
    if (!music) {
      return NextResponse.json(
        { ok: false, message: "找不到音樂" },
        { status: 404 }
      );
    }

    // 權限：作者或管理員
    const isOwner = music.author.toString() === currentUser._id.toString();
    const isAdmin = !!currentUser?.isAdmin;
    if (!(isOwner || isAdmin)) {
      return NextResponse.json(
        { ok: false, message: "沒有權限編輯此音樂" },
        { status: 403 }
      );
    }

    // 建立更新物件（只挑允許欄位）
    const updates = {};
    for (const k of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates[k] = body[k];
      }
    }

    // 欄位型別處理
    if ("tags" in updates) {
      updates.tags = normalizeTags(updates.tags);
    }

    if ("genre" in updates && Array.isArray(updates.genre)) {
      updates.genre = updates.genre.filter((g) => g && g.trim());
    }

    // 數值欄位
    if ("tempo" in updates) updates.tempo = toNumOrNull(updates.tempo);
    if ("styleInfluence" in updates)
      updates.styleInfluence = toNumOrNull(updates.styleInfluence);
    if ("weirdness" in updates)
      updates.weirdness = toNumOrNull(updates.weirdness);

    // 字串欄位（trim 處理）
    const stringFields = [
      "title",
      "description",
      "category",
      "rating",
      "platform",
      "prompt",
      "modelName",
      "modelLink",
      "language",
      "mood",
      "key",
      "lyrics",
      "singerGender",
      "seed",
      "excludeStyles",
    ];
    for (const k of stringFields) {
      if (k in updates) {
        updates[k] = String(updates[k] || "").trim();
      }
    }

    // 處理封面圖片上傳（如果有新封面）
    if (coverFile && coverFile instanceof File) {
      try {
        const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
        const coverMimeType = coverFile.type || "image/jpeg";
        
        // 驗證 MIME type
        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (validTypes.includes(coverMimeType)) {
          // 獲取文件擴展名
          const extMap = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
          };
          const ext = extMap[coverMimeType] || "jpg";
          
          // 生成封面檔案名稱
          const timestamp = Date.now();
          const coverFileName = `music/${currentUser._id}/${timestamp}-cover-edit.${ext}`;
          
          // 上傳封面到 R2
          const coverUploadCommand = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: coverFileName,
            Body: coverBuffer,
            ContentType: coverMimeType,
          });
          
          await s3Client.send(coverUploadCommand);
          
          // 生成封面公開 URL
          music.coverImageUrl = `${R2_PUBLIC_URL}/${coverFileName}`;
          
          // 如果有提供位置資訊，使用它；否則保持原有位置或使用預設值
          if (coverPosition && typeof coverPosition === "string") {
            music.coverPosition = coverPosition.trim() || "center";
          } else if (!music.coverPosition) {
            music.coverPosition = "center";
          }
        }
      } catch (coverError) {
        console.warn("⚠️ 上傳封面失敗:", coverError.message);
        // 繼續執行，不影響其他欄位更新
      }
    } else if (coverPosition && typeof coverPosition === "string") {
      // 如果只更新位置（沒有新文件），也要更新位置
      music.coverPosition = coverPosition.trim() || music.coverPosition || "center";
    }

    // 更新音樂資料
    for (const k of allowedFields) {
      if (k in updates) {
        music[k] = updates[k];
      }
    }

    // 重新計算完整度（但不重算 popScore）
    music.completenessScore = computeMusicCompleteness(music);
    music.hasMetadata = music.completenessScore >= 30;

    // 確保 likesCount 同步（數據一致性）
    if (Array.isArray(music.likes)) {
      music.likesCount = music.likes.length;
    }

    // ❌ 不重算 popScore - 編輯元數據不應影響熱門度
    // popScore 只在互動時更新（點讚、點擊）

    await music.save();

    // 重新填充作者資訊
    await music.populate("author", "username image currentFrame frameSettings");

    // 回傳最新資料
    const saved = await Music.findById(id)
      .populate({
        path: "author",
        select: "_id username image currentFrame frameSettings",
      })
      .lean();

    return NextResponse.json({ ok: true, music: saved });
  } catch (err) {
    console.error("❌ PATCH /api/music/[id]/edit 失敗：", err);
    return NextResponse.json(
      { ok: false, message: "更新失敗" },
      { status: 500 }
    );
  }
}


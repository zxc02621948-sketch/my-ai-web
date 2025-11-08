import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import {
  computeMusicCompleteness,
  computeMusicInitialBoostFromTop,
  computeMusicPopScore,
} from "@/utils/scoreMusic";
import { parseBuffer } from "music-metadata";

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    // 連接資料庫
    await dbConnect();

    // 解析表單資料
    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title");
    const description = formData.get("description");
    const tags = formData.get("tags");

    // ✅ AI 生成元數據
    const platform = formData.get("platform") || "";
    const prompt = formData.get("prompt") || "";
    const modelName = formData.get("modelName") || "";
    const modelLink = formData.get("modelLink") || "";

    // ✅ 音樂屬性
    // 處理 genres 陣列（從 'genres[]' 獲取所有值）
    const genresArray = formData.getAll("genres[]").filter((g) => g);
    const mood = formData.get("mood") || "";
    const tempo = formData.get("tempo") ? Number(formData.get("tempo")) : null;
    const key = formData.get("key") || "";

    // ✅ 生成參數
    const seed = formData.get("seed") || "";

    // ✅ Suno 專用參數
    const excludeStyles = formData.get("excludeStyles") || "";
    const styleInfluence = formData.get("styleInfluence")
      ? Number(formData.get("styleInfluence"))
      : null;
    const weirdness = formData.get("weirdness")
      ? Number(formData.get("weirdness"))
      : null;

    // ✅ 歌曲專用屬性
    const lyrics = formData.get("lyrics") || "";
    const singerGender = formData.get("singerGender") || "";

    // ✅ 分級與分類
    const rating = formData.get("rating") || "all";
    const category = formData.get("category") || "";
    const language = formData.get("language") || "";
    const isPublicField = formData.get("isPublic");
    let isPublic = true;
    if (typeof isPublicField === "string") {
      const normalized = isPublicField.trim().toLowerCase();
      if (["false", "0", "no", "off", "private"].includes(normalized)) {
        isPublic = false;
      } else if (["true", "1", "yes", "on", "public"].includes(normalized)) {
        isPublic = true;
      }
    }

    if (!file) {
      return NextResponse.json({ error: "請選擇音樂檔案" }, { status: 400 });
    }

    // 檢查檔案類型
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/flac",
      "audio/mp4",
      "audio/x-m4a",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "不支援的音樂格式" }, { status: 400 });
    }

    // 檢查檔案大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "音樂檔案過大，請選擇小於 10MB 的檔案（建議 2-5 分鐘）" },
        { status: 400 },
      );
    }

    // 生成檔案名稱
    const timestamp = Date.now();
    const fileName = `music/${user._id}/${timestamp}-${file.name}`;

    // 上傳到 R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(uploadCommand);

    // 生成公開 URL
    const musicUrl = `${R2_PUBLIC_URL}/${fileName}`;

    // ✅ 嘗試提取 MP3 封面圖片
    let coverImageUrl = "";
    let duration = 0;
    try {
      const metadata = await parseBuffer(buffer);
      
      // 提取時長
      if (metadata.format.duration) {
        duration = Math.round(metadata.format.duration);
      }

      // 提取封面圖片
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0]; // 使用第一張圖片
        const coverBuffer = picture.data;
        let coverMimeType = picture.format || "image/jpeg";
        
        // 確保 MIME type 正確
        if (!coverMimeType.startsWith("image/")) {
          coverMimeType = "image/jpeg"; // 默認為 JPEG
        }
        
        // 獲取文件擴展名
        const extMap = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/gif": "gif",
          "image/webp": "webp",
          "image/bmp": "bmp",
        };
        const ext = extMap[coverMimeType] || "jpg";
        
        // 生成封面檔案名稱
        const coverFileName = `music/${user._id}/${timestamp}-cover.${ext}`;
        
        // 上傳封面到 R2
        const coverUploadCommand = new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: coverFileName,
          Body: coverBuffer,
          ContentType: coverMimeType,
        });
        
        await s3Client.send(coverUploadCommand);
        
        // 生成封面公開 URL
        coverImageUrl = `${R2_PUBLIC_URL}/${coverFileName}`;
        
        console.log(`✅ 成功提取並上傳封面: ${coverImageUrl} (${coverMimeType})`);
      } else {
        console.log("ℹ️ 此 MP3 檔案沒有嵌入封面圖片");
      }
    } catch (metadataError) {
      console.warn("⚠️ 提取 MP3 元數據失敗:", metadataError.message);
      // 繼續執行，不影響上傳流程
    }

    // ✅ 獲取當前最高分數（用於計算 initialBoost）
    const topMusic = await Music.findOne({})
      .sort({ popScore: -1 })
      .select("popScore")
      .lean();
    const topScore = topMusic?.popScore || 0;
    const initialBoost = computeMusicInitialBoostFromTop(topScore);

    // ✅ 建立音樂文檔
    const musicDoc = {
      title: title || "未命名音樂",
      description: description || "",
      tags: tags
        ? tags
            .split(/[,\s]+/)
            .map((tag) => tag.trim())
            .filter((t) => t)
        : [],
      musicUrl,
      coverImageUrl, // 從 MP3 提取的封面圖片
      duration, // 從 MP3 提取的時長
      author: user._id,
      authorName: user.username,
      authorAvatar: user.image || "",
      likes: [],
      likesCount: 0,
      plays: 0,
      clicks: 0,

      // ✅ AI 生成元數據
      platform,
      prompt,
      modelName,
      modelLink,

      // ✅ 音樂屬性
      genre: genresArray, // 改為陣列
      language,
      mood,
      tempo,
      key,

      // ✅ 歌曲專用屬性
      lyrics,
      singerGender,

      // ✅ 生成參數
      seed,
      format: file.type.split("/")[1], // 從 MIME type 提取

      // ✅ Suno 專用參數
      excludeStyles,
      styleInfluence,
      weirdness,

      // ✅ 分級與分類
      rating,
      category,

      // ✅ 計算完整度
      completenessScore: 0,
      hasMetadata: false,
      popScore: 0,
      initialBoost,

      uploadDate: new Date(),
      isPublic,
    };

    // ✅ 計算完整度
    musicDoc.completenessScore = computeMusicCompleteness(musicDoc);
    musicDoc.hasMetadata = musicDoc.completenessScore >= 30; // 30分以上視為有元數據

    // ✅ 計算初始熱門度分數（包含 initialBoost）
    musicDoc.popScore = computeMusicPopScore(musicDoc);

    // 儲存到資料庫
    const music = new Music(musicDoc);
    await music.save();

    return NextResponse.json({
      success: true,
      music: {
        id: music._id,
        title: music.title,
        musicUrl: `/api/music/stream/${music._id}`, // ✅ 返回串流 API URL
        coverImageUrl: music.coverImageUrl,
        completenessScore: music.completenessScore,
        hasMetadata: music.hasMetadata,
      },
      message: "音樂上傳成功！",
    });
  } catch (error) {
    return NextResponse.json({ error: "音樂上傳失敗" }, { status: 500 });
  }
}

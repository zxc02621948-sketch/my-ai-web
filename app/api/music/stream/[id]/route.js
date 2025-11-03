import { NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // ✅ 基本保護：檢查 Referer
    const referer = request.headers.get("referer") || "";
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = [
      "http://localhost:3000",
      "https://aicreateaworld.com",
      "https://www.aicreateaworld.com",
      "https://my-ai-web.onrender.com",
    ];

    const isAllowedReferer = allowedOrigins.some(
      (allowed) => referer.includes(allowed) || origin.includes(allowed),
    );

    // 如果 Referer 不符合，返回 403
    // 注意：某些瀏覽器或環境可能沒有 Referer，這可能會阻擋合法用戶
    // 暫時只做記錄，不做強制阻擋
    if (!isAllowedReferer && referer && origin) {
      // 可疑訪問（隱藏日誌以減少終端訊息）
    }

    // 連接資料庫並查找音樂
    await dbConnect();
    const music = await Music.findById(id);

    if (!music) {
      return new NextResponse("音樂不存在", { status: 404 });
    }

    // 提取 R2 key（如果 musicUrl 是完整 URL，需要提取 key）
    let r2Key;
    if (music.musicUrl) {
      // 從完整 URL 中提取 key：https://media.aicreateaworld.com/music/xxx/file.mp3
      try {
        const url = new URL(music.musicUrl);
        r2Key = url.pathname.substring(1); // 移除開頭的 /
        // URL 解碼（R2 key 在儲存時沒有編碼）
        r2Key = decodeURIComponent(r2Key);
      } catch {
        // 如果 musicUrl 本身就是 key
        r2Key = music.musicUrl;
      }
    } else {
      return new NextResponse("音樂檔案不存在", { status: 404 });
    }

    // 從請求頭中獲取 Range
    const range = request.headers.get("range");

    try {
      // 先使用 HeadObjectCommand 獲取檔案資訊
      let contentLength = 0;
      let contentType = "audio/mpeg";

      try {
        const headCommand = new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
        });

        const headResponse = await s3Client.send(headCommand);
        contentLength = headResponse.ContentLength || 0;
        contentType = headResponse.ContentType || "audio/mpeg";
      } catch (headError) {
        // 無法獲取檔案資訊時使用預設值
      }

      // 如果沒有 Range 請求，直接返回完整檔案
      if (!range) {
        const getCommand = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
        });

        const streamResponse = await s3Client.send(getCommand);
        const bodyStream = streamResponse.Body;

        // ✅ 移除自動計數邏輯，改為由客戶端追蹤進度後通過 /api/music/[id]/track-progress 計數

        return new NextResponse(bodyStream, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": contentLength.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      // 解析 Range 請求
      const bytesPrefix = "bytes=";
      if (!range || !range.startsWith(bytesPrefix)) {
        return new NextResponse("Invalid Range", { status: 416 });
      }

      const bytesRange = range.substring(bytesPrefix.length);
      const parts = bytesRange.split("-");

      let start = parseInt(parts[0], 10);
      let end = contentLength - 1;

      if (parts[1]) {
        end = parseInt(parts[1], 10);
      }

      // 驗證範圍
      if (start >= contentLength || end >= contentLength) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${contentLength}`,
          },
        });
      }

      const chunksize = end - start + 1;

      // 使用 Range 從 R2 獲取部分檔案
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Range: `bytes=${start}-${end}`,
      });

      const streamResponse = await s3Client.send(getCommand);

      // ✅ 移除自動計數邏輯，改為由客戶端追蹤進度後通過 /api/music/[id]/track-progress 計數
      // 這樣可以實現：1. 預覽不計數 2. 播放進度達到 10% 才計數

      return new NextResponse(streamResponse.Body, {
        status: 206, // Partial Content
        headers: {
          "Content-Range": `bytes ${start}-${end}/${contentLength}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      return new NextResponse("檔案讀取失敗", { status: 500 });
    }
  } catch (error) {
    return new NextResponse("伺服器錯誤", { status: 500 });
  }
}

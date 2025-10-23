export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { computeVideoCompleteness } from "@/utils/scoreVideo";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function PUT(req, { params }) {
  try {
    // 驗證登入 - 使用統一的 JWT 認證
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "未登入" },
        { status: 401, ...noStore }
      );
    }

    const { id } = params;
    await dbConnect();

    // 查找影片
    const video = await Video.findById(id);
    if (!video) {
      return NextResponse.json(
        { error: "找不到影片" },
        { status: 404, ...noStore }
      );
    }

    // 檢查權限（只有作者可以編輯）
    if (String(video.author) !== String(user._id)) {
      return NextResponse.json(
        { error: "無權限編輯此影片" },
        { status: 403, ...noStore }
      );
    }

    // 解析請求資料
    const body = await req.json();
    const {
      title,
      description,
      tags,
      rating,
      category,
      platform,
      prompt,
      negativePrompt,
      fps,
      resolution,
      steps,
      cfgScale,
      seed,
    } = body;

    // 驗證必填欄位
    if (!title?.trim()) {
      return NextResponse.json(
        { error: "標題為必填" },
        { status: 400, ...noStore }
      );
    }

    if (!rating) {
      return NextResponse.json(
        { error: "分級為必填" },
        { status: 400, ...noStore }
      );
    }

    // 更新影片資料
    video.title = title.trim();
    video.description = description?.trim() || "";
    video.tags = Array.isArray(tags) ? tags : [];
    video.rating = rating;
    video.category = category || "";
    video.platform = platform?.trim() || "";
    video.prompt = prompt?.trim() || "";
    video.negativePrompt = negativePrompt?.trim() || "";
    video.fps = fps?.trim() || "";
    video.resolution = resolution?.trim() || "";
    video.steps = steps?.trim() || "";
    video.cfgScale = cfgScale?.trim() || "";
    video.seed = seed?.trim() || "";

    // ✅ 重新計算完整度（但不重算 popScore）
    video.completenessScore = computeVideoCompleteness(video);
    video.hasMetadata = video.completenessScore >= 30;
    
    // ❌ 不重算 popScore - 編輯元數據不應影響熱門度排序
    // popScore 只在互動時更新（點讚、點擊）
    // 讓用戶可以安心修改錯字而不影響排名

    // 儲存
    await video.save();

    // 重新填充作者資訊
    await video.populate('author', 'username avatar currentFrame frameSettings');

    return NextResponse.json(
      { 
        success: true, 
        message: "影片更新成功",
        video: video.toObject()
      },
      { status: 200, ...noStore }
    );
  } catch (error) {
    console.error("[videos/edit] Error:", error);
    return NextResponse.json(
      { error: error.message || "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}


import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await dbConnect();

    const { id } = await params;

    // 查找視頻
    const video = await Video.findById(id)
      .populate("author", "_id username image currentFrame frameSettings")
      .lean();

    if (!video) {
      return NextResponse.json({ error: "視頻不存在" }, { status: 404 });
    }

    // 返回視頻信息
    return NextResponse.json({
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        tags: video.tags,
        category: video.category,
        categories: video.categories,
        thumbnailUrl: video.thumbnailUrl || video.previewUrl,
        videoUrl: video.videoUrl,
        duration: video.duration,
        authorName: video.authorName || video.author?.username || "",
        author: video.author ? {
          _id: video.author._id,
          username: video.author.username,
          image: video.author.image,
          currentFrame: video.author.currentFrame,
          frameSettings: video.author.frameSettings,
        } : null,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      },
    });
  } catch (error) {
    console.error("獲取視頻信息失敗:", error);
    return NextResponse.json(
      { error: "獲取視頻信息失敗" },
      { status: 500 }
    );
  }
}


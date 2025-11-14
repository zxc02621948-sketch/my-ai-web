import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await dbConnect();

    const { id } = await params;

    // 查找音樂
    const music = await Music.findById(id)
      .populate("author", "_id username avatar currentFrame frameSettings")
      .lean();

    if (!music) {
      return NextResponse.json({ error: "音樂不存在" }, { status: 404 });
    }

    // 返回音樂信息（用於 Media Session API）
    return NextResponse.json({
      music: {
        _id: music._id,
        title: music.title,
        coverImageUrl: music.coverImageUrl || "",
        authorName: music.authorName || music.author?.username || "",
        authorAvatar: music.authorAvatar || music.author?.avatar || "",
        author: music.author ? {
          _id: music.author._id,
          username: music.author.username,
          avatar: music.author.avatar,
        } : null,
      },
    });
  } catch (error) {
    console.error("獲取音樂信息失敗:", error);
    return NextResponse.json(
      { error: "獲取音樂信息失敗" },
      { status: 500 }
    );
  }
}


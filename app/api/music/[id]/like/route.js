import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { computeMusicPopScore } from "@/utils/scoreMusic";

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const music = await Music.findById(id);

    if (!music) {
      return NextResponse.json({ error: "音樂不存在" }, { status: 404 });
    }

    // 檢查用戶是否已經點過愛心
    const isLiked = music.likes && music.likes.includes(user._id);

    if (isLiked) {
      // 取消愛心
      music.likes = music.likes.filter(
        (likeId) => likeId.toString() !== user._id.toString(),
      );
    } else {
      // 添加愛心
      if (!music.likes) {
        music.likes = [];
      }
      music.likes.push(user._id);
    }

    // ✅ 同步 likesCount
    music.likesCount = music.likes.length;

    // ✅ 重新計算熱門度分數
    music.popScore = computeMusicPopScore(music);

    await music.save();

    return NextResponse.json({
      success: true,
      likes: music.likes,
      likesCount: music.likesCount,
      isLiked: !isLiked,
    });
  } catch (error) {
    return NextResponse.json({ error: "愛心切換失敗" }, { status: 500 });
  }
}

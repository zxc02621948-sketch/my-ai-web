import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { computeVideoPopScore } from '@/utils/scoreVideo';

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const video = await Video.findById(id);

    if (!video) {
      return NextResponse.json({ error: '影片不存在' }, { status: 404 });
    }

    // 檢查用戶是否已經點過愛心
    const isLiked = video.likes && video.likes.includes(user._id);
    
    if (isLiked) {
      // 取消愛心
      video.likes = video.likes.filter(likeId => likeId.toString() !== user._id.toString());
    } else {
      // 添加愛心
      if (!video.likes) {
        video.likes = [];
      }
      video.likes.push(user._id);
    }

    // ✅ 同步 likesCount
    video.likesCount = video.likes.length;
    
    // ✅ 重新計算熱門度分數
    video.popScore = computeVideoPopScore(video);

    await video.save();

    return NextResponse.json({
      success: true,
      likes: video.likes,
      isLiked: !isLiked
    });

  } catch (error) {
    console.error('愛心切換失敗:', error);
    return NextResponse.json({ error: '愛心切換失敗' }, { status: 500 });
  }
}


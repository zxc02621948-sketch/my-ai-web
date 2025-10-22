import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';

export async function POST(request) {
  try {
    // 檢查用戶權限（只有管理員可以刪除）
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    await dbConnect();

    // 找到所有使用舊 URL 格式的影片
    const oldVideos = await Video.find({
      videoUrl: { $regex: /media\.aicreateaworld\.com/ }
    });

    console.log(`找到 ${oldVideos.length} 個舊格式的影片`);

    if (oldVideos.length === 0) {
      return NextResponse.json({
        success: true,
        message: '沒有舊格式的影片需要刪除',
        deletedCount: 0
      });
    }

    // 刪除舊影片
    const deleteResult = await Video.deleteMany({
      videoUrl: { $regex: /media\.aicreateaworld\.com/ }
    });

    console.log(`成功刪除 ${deleteResult.deletedCount} 個舊影片`);

    return NextResponse.json({
      success: true,
      message: `成功刪除 ${deleteResult.deletedCount} 個舊格式的影片`,
      deletedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('刪除舊影片失敗:', error);
    return NextResponse.json({
      success: false,
      error: '刪除失敗',
      details: error.message
    }, { status: 500 });
  }
}




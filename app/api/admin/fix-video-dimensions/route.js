import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    await dbConnect();

    // 查找所有沒有 width/height 的影片
    const videosWithoutDimensions = await Video.find({
      $or: [
        { width: { $exists: false } },
        { height: { $exists: false } },
        { width: null },
        { height: null }
      ]
    });

    console.log(`找到 ${videosWithoutDimensions.length} 個沒有尺寸的影片`);

    let updatedCount = 0;
    for (const video of videosWithoutDimensions) {
      // 設定預設尺寸（假設是直式手機影片 9:16）
      video.width = 1080;
      video.height = 1920;
      await video.save();
      
      // 驗證儲存
      const saved = await Video.findById(video._id);
      console.log(`更新影片 ${video.title} 的尺寸: 1080x1920, 驗證: width=${saved.width}, height=${saved.height}`);
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${updatedCount} 個影片的尺寸為預設值（1080x1920）`,
      updatedCount
    });

  } catch (error) {
    console.error('更新影片尺寸失敗:', error);
    return NextResponse.json({ error: '更新失敗', details: error.message }, { status: 500 });
  }
}


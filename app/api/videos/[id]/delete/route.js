import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { deleteFromR2 } from '@/lib/r2';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';

export async function DELETE(request, { params }) {
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

    // 檢查是否為影片擁有者
    if (video.author.toString() !== user._id.toString()) {
      return NextResponse.json({ error: '無權限刪除此影片' }, { status: 403 });
    }

    try {
      // 從 R2 刪除檔案
      // 從 URL 提取 key: https://pub-xxx.r2.dev/videos/userId/filename.mp4 -> videos/userId/filename.mp4
      const urlParts = video.videoUrl.split('/');
      const r2Key = urlParts.slice(3).join('/'); // 取得 "videos/userId/filename.mp4"
      
      console.log('🗑️ 刪除 R2 檔案:', r2Key);
      await deleteFromR2(r2Key);
    } catch (r2Error) {
      console.error('從 R2 刪除檔案失敗:', r2Error);
      // 即使 R2 刪除失敗，仍繼續刪除資料庫記錄
    }

    // 從資料庫刪除
    await Video.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: '影片已刪除',
    });

  } catch (error) {
    console.error('刪除影片失敗:', error);
    return NextResponse.json({ error: '刪除影片失敗', details: error.message }, { status: 500 });
  }
}


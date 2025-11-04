import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Music from '@/models/Music';
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
    const music = await Music.findById(id);

    if (!music) {
      return NextResponse.json({ error: '音樂不存在' }, { status: 404 });
    }

    // 檢查是否為音樂擁有者
    if (music.author.toString() !== user._id.toString()) {
      return NextResponse.json({ error: '無權限刪除此音樂' }, { status: 403 });
    }

    try {
      // 從 R2 刪除檔案（如果音樂存儲在 R2 上）
      if (music.musicUrl && music.musicUrl.includes('/api/music/')) {
        // 從 URL 提取 key: https://pub-xxx.r2.dev/music/userId/filename.mp3 -> music/userId/filename.mp3
        const urlParts = music.musicUrl.split('/');
        const r2Key = urlParts.slice(3).join('/'); // 取得 "music/userId/filename.mp3"
        
        console.log('🗑️ 刪除 R2 檔案:', r2Key);
        await deleteFromR2(r2Key);
      }
    } catch (r2Error) {
      console.error('從 R2 刪除檔案失敗:', r2Error);
      // 即使 R2 刪除失敗，仍繼續刪除資料庫記錄
    }

    // 從資料庫刪除
    await Music.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: '音樂已刪除',
    });

  } catch (error) {
    console.error('刪除音樂失敗:', error);
    return NextResponse.json({ error: '刪除音樂失敗', details: error.message }, { status: 500 });
  }
}

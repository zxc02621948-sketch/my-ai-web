import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';
import { put } from '@vercel/blob';

// 分塊上傳配置
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // 每個塊的大小限制
    },
  },
  maxDuration: 60,
};

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk');
    const chunkIndex = parseInt(formData.get('chunkIndex'));
    const totalChunks = parseInt(formData.get('totalChunks'));
    const fileName = formData.get('fileName');
    const fileSize = parseInt(formData.get('fileSize'));
    const uploadId = formData.get('uploadId');

    if (!chunk || chunkIndex === undefined || totalChunks === undefined || !fileName || !uploadId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 如果是第一個塊，初始化上傳
    if (chunkIndex === 0) {
      // 創建臨時檔案記錄
      const tempVideo = new Video({
        title: fileName,
        description: '',
        category: 'general',
        rating: 'sfw',
        uploader: user._id,
        uploadId: uploadId,
        status: 'uploading',
        totalChunks: totalChunks,
        receivedChunks: 0,
        fileSize: fileSize,
      });
      await tempVideo.save();
    }

    // 上傳塊到 Cloudflare R2
    const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;
    const blob = await put(chunkFileName, chunk, {
      access: 'public',
    });

    // 更新接收到的塊數
    await Video.findOneAndUpdate(
      { uploadId: uploadId },
      { $inc: { receivedChunks: 1 } }
    );

    // 檢查是否所有塊都已上傳
    const video = await Video.findOne({ uploadId: uploadId });
    if (video.receivedChunks >= totalChunks) {
      // 所有塊都已上傳，開始合併
      // 這裡需要實作合併邏輯
      // 暫時返回成功
      return NextResponse.json({
        success: true,
        message: 'All chunks uploaded, merging in progress...',
        uploadId: uploadId,
        completed: true
      });
    }

    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
      uploadId: uploadId,
      completed: false
    });

  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error.message 
    }, { status: 500 });
  }
}

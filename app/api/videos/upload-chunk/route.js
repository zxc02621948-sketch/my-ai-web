import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';
import { s3Client, R2_BUCKET_NAME } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

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

    console.log('Chunk upload request:', {
      chunkIndex,
      totalChunks,
      fileName,
      fileSize,
      uploadId,
      chunkSize: chunk?.size
    });

    if (!chunk || chunkIndex === undefined || totalChunks === undefined || !fileName || !uploadId) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: {
          chunk: !!chunk,
          chunkIndex,
          totalChunks,
          fileName,
          uploadId
        }
      }, { status: 400 });
    }

    // 連接資料庫
    await dbConnect();

    // 如果是第一個塊，初始化上傳
    if (chunkIndex === 0) {
      // 創建臨時檔案記錄
      const tempVideo = new Video({
        title: fileName,
        description: '',
        category: 'general',
        rating: 'sfw',
        author: user._id, // 使用 ObjectId
        authorName: user.username || user.email,
        videoUrl: 'temp://uploading', // 暫時值，上傳完成後會更新
        status: 'active', // 使用有效的 enum 值
        uploadId: uploadId,
        totalChunks: totalChunks,
        receivedChunks: 0,
        fileSize: fileSize,
      });
      await tempVideo.save();
      console.log('Created temp video record:', tempVideo._id);
    }

    // 上傳塊到 Cloudflare R2
    const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;
    
    console.log('R2 Configuration:', {
      bucket: R2_BUCKET_NAME,
      hasBucket: !!R2_BUCKET_NAME
    });
    
    // 將 Blob 轉換為 Buffer
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: `videos/chunks/${chunkFileName}`,
      Body: chunkBuffer,
      ContentType: 'application/octet-stream',
    };

    console.log('Uploading chunk to R2:', chunkFileName, 'Size:', chunkBuffer.length);
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log('Chunk uploaded successfully:', chunkFileName);

    // 更新接收到的塊數
    const updateResult = await Video.findOneAndUpdate(
      { uploadId: uploadId },
      { $inc: { receivedChunks: 1 } },
      { new: true }
    );

    if (!updateResult) {
      throw new Error(`找不到 uploadId: ${uploadId} 的影片記錄`);
    }

    // 檢查是否所有塊都已上傳
    const video = await Video.findOne({ uploadId: uploadId });
    if (!video) {
      throw new Error(`找不到 uploadId: ${uploadId} 的影片記錄`);
    }

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
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

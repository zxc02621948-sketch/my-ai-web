import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';
import { uploadToR2 } from '@/lib/r2';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Stream API 支援更大的檔案
    },
  },
  maxDuration: 300, // 5 分鐘執行時間
};

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || '未命名影片';
    const description = formData.get('description') || '';
    const category = formData.get('category') || 'general';
    const rating = formData.get('rating') || 'sfw';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('Hybrid upload request:', {
      fileName: file.name,
      fileSize: file.size,
      title,
      category,
      rating
    });

    // 連接資料庫
    await dbConnect();

    // 步驟 1: 上傳到 Cloudflare Stream
    const streamResult = await uploadToStream(file, title);
    
    if (!streamResult.success) {
      throw new Error(streamResult.error);
    }

    console.log('Stream upload successful:', streamResult.streamId);

    // 步驟 2: 從 Stream 生成預覽影片並上傳到 R2
    const previewResult = await generatePreviewAndUpload(streamResult.streamId, title);
    
    if (!previewResult.success) {
      console.warn('Preview generation failed:', previewResult.error);
      // 繼續執行，但沒有預覽影片
    }

    // 步驟 3: 創建影片記錄
    const video = new Video({
      title,
      description,
      category,
      rating,
      author: user._id,
      authorName: user.username || user.email,
      videoUrl: streamResult.playbackUrl, // Stream 播放連結
      streamId: streamResult.streamId,
      previewUrl: previewResult.success ? previewResult.previewUrl : '', // R2 預覽連結
      thumbnailUrl: `https://videodelivery.net/${streamResult.streamId}/thumbnails/thumbnail.jpg?time=1s`,
      status: 'active',
    });

    await video.save();
    console.log('Video record created:', video._id);

    // 計算分數
    const completenessScore = computeVideoCompleteness(video);
    const initialBoost = computeVideoInitialBoostFromTop(video);
    const popScore = computeVideoPopScore(video, completenessScore, initialBoost);

    video.completenessScore = completenessScore;
    video.initialBoost = initialBoost;
    video.popScore = popScore;
    await video.save();

    return NextResponse.json({
      success: true,
      video: {
        id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        previewUrl: video.previewUrl,
        streamId: video.streamId,
        thumbnailUrl: video.thumbnailUrl,
        completenessScore: video.completenessScore,
        popScore: video.popScore,
      }
    });

  } catch (error) {
    console.error('Hybrid upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error.message 
    }, { status: 500 });
  }
}

// 上傳到 Cloudflare Stream 的函數
async function uploadToStream(file, title) {
  try {
    console.log('Uploading to Cloudflare Stream...', {
      fileName: file.name,
      fileSize: file.size,
      title
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', title);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Stream API error response:', errorData);
      throw new Error(`Stream API error: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Stream API success:', data);
    
    return {
      success: true,
      streamId: data.result.uid,
      playbackUrl: data.result.playback.hls,
    };
  } catch (error) {
    console.error('Stream upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 從 Stream 生成預覽影片並上傳到 R2
async function generatePreviewAndUpload(streamId, title) {
  try {
    console.log('Generating preview for Stream ID:', streamId);

    // 步驟 1: 從 Stream 下載影片
    const streamUrl = `https://customer-h5be4kbubhrszsgr.cloudflarestream.com/${streamId}/manifest/video.m3u8`;
    
    // 步驟 2: 使用 ffmpeg 生成預覽影片（前2秒）
    // 這裡需要實作 ffmpeg 處理邏輯
    // 暫時返回成功，但沒有預覽 URL
    console.log('Preview generation not implemented yet');
    
    return {
      success: false,
      error: 'Preview generation not implemented yet',
    };
  } catch (error) {
    console.error('Preview generation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

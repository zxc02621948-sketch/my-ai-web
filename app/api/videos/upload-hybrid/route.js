import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';
import { uploadToR2, generateR2Key } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
  maxDuration: 300,
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

    // 步驟 1: 上傳到 R2（直接上傳，無需經過 Stream）
    console.log('Uploading directly to R2...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = generateR2Key(user._id.toString(), 'videos', file.name);
    const videoUrl = await uploadToR2(buffer, key, file.type);

    console.log('R2 upload successful:', videoUrl);

    // 步驟 2: 創建影片記錄
    const video = new Video({
      title,
      description,
      category,
      rating,
      author: user._id,
      authorName: user.username || user.email,
      videoUrl: videoUrl,
      streamId: null,
      previewUrl: '',
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



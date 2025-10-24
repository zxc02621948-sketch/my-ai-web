import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      streamId, 
      playbackUrl, 
      title, 
      description, 
      category, 
      rating,
      tags,
      platform,
      prompt,
      negativePrompt,
      fps,
      resolution,
      steps,
      cfgScale,
      seed,
      width,
      height,
      duration
    } = body;

    if (!streamId || !playbackUrl) {
      return NextResponse.json({ 
        error: 'Missing required fields: streamId and playbackUrl' 
      }, { status: 400 });
    }

    console.log('Saving Stream record:', {
      streamId,
      title,
      category,
      rating
    });

    // 連接資料庫
    await dbConnect();

    // 創建影片記錄
    const video = new Video({
      title: title || '未命名影片',
      description: description || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      category: category || 'general',
      rating: rating || 'sfw',
      author: user._id,
      authorName: user.username || user.email,
      videoUrl: playbackUrl,
      streamId: streamId,
      status: 'active',
      // AI 生成元數據
      platform: platform || '',
      prompt: prompt || '',
      negativePrompt: negativePrompt || '',
      // 生成參數
      fps: fps || '',
      resolution: resolution || '',
      steps: steps || '',
      cfgScale: cfgScale || '',
      seed: seed || '',
      // 影片尺寸
      width: width || null,
      height: height || null,
      duration: duration || null,
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
        streamId: video.streamId,
        completenessScore: video.completenessScore,
        popScore: video.popScore,
      }
    });

  } catch (error) {
    console.error('Save Stream record error:', error);
    return NextResponse.json({ 
      error: 'Save failed', 
      details: error.message 
    }, { status: 500 });
  }
}

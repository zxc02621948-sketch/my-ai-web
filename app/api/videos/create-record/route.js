import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      title,
      description = '',
      tags = '',
      category = 'general',
      rating = 'sfw',
      platform = '',
      prompt = '',
      negativePrompt = '',
      fps = null,
      resolution = '',
      steps = null,
      cfgScale = null,
      seed = '',
      width = null,
      height = null,
      duration = null,
      videoUrl,
      videoKey,
    } = data;

    if (!videoUrl || !videoKey) {
      return NextResponse.json({ error: 'Missing video URL or key' }, { status: 400 });
    }

    await dbConnect();

    const video = new Video({
      title: title || '未命名影片',
      description,
      category,
      rating,
      author: user._id,
      authorName: user.username || user.email,
      authorAvatar: user.image || '',
      videoUrl,
      streamId: null,
      previewUrl: '',
      status: 'active',
      width,
      height,
      duration,
      tags: tags ? tags.split(/[,\s]+/).map(tag => tag.trim()).filter(t => t) : [],
      platform,
      prompt,
      negativePrompt,
      modelName: '',
      modelLink: '',
      fps,
      resolution,
      steps,
      cfgScale,
      seed,
      likes: [],
      likesCount: 0,
      views: 0,
      clicks: 0,
      uploadDate: new Date(),
      isPublic: true,
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
        completenessScore: video.completenessScore,
        popScore: video.popScore,
      }
    });

  } catch (error) {
    console.error('Create record error:', error);
    return NextResponse.json({ 
      error: 'Failed to create video record', 
      details: error.message 
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';
import { generateR2Key, R2_PUBLIC_URL } from '@/lib/r2';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 增加到 5 分鐘

// 直接創建 S3Client for streaming
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title') || '未命名影片';
    const description = formData.get('description') || '';
    const tags = formData.get('tags') || '';
    const category = formData.get('category') || 'general';
    const rating = formData.get('rating') || 'sfw';
    const platform = formData.get('platform') || '';
    const prompt = formData.get('prompt') || '';
    const negativePrompt = formData.get('negativePrompt') || '';
    const fps = formData.get('fps') || null;
    const resolution = formData.get('resolution') || '';
    const steps = formData.get('steps') || null;
    const cfgScale = formData.get('cfgScale') || null;
    const seed = formData.get('seed') || '';
    const videoWidth = formData.get('width') || null;
    const videoHeight = formData.get('height') || null;
    const duration = formData.get('duration') || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支援的影片格式' }, { status: 400 });
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '影片檔案過大，請選擇小於 100MB 的檔案' }, { status: 400 });
    }

    // 使用 Streaming 上傳到 R2
    const key = generateR2Key(user._id.toString(), 'videos', file.name);
    
    console.log('Starting streaming upload to R2:', { key, size: file.size });

    // Stream the file directly to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: file.stream(), // 使用 stream() 而不是 arrayBuffer()
      ContentType: file.type,
    });

    await s3Client.send(command);
    
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    console.log('Upload completed:', publicUrl);

    await dbConnect();

    const video = new Video({
      title,
      description,
      category,
      rating,
      author: user._id,
      authorName: user.username || user.email,
      authorAvatar: user.image || '',
      videoUrl: publicUrl,
      streamId: null,
      previewUrl: '',
      status: 'active',
      width: videoWidth,
      height: videoHeight,
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
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload video', 
      details: error.message 
    }, { status: 500 });
  }
}

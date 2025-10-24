import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { computeVideoCompleteness, computeVideoInitialBoostFromTop, computeVideoPopScore } from '@/utils/scoreVideo';

// ✅ 設定請求體大小限制
export const config = {
  bodyParser: {
    sizeLimit: '25mb',
  },
};

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 連接資料庫
    await dbConnect();

    // ===== 檢查每日上傳限制 =====
    const today = new Date().toDateString();
    const lastUploadDate = user.lastVideoUploadDate?.toDateString();

    // 如果是新的一天，重置計數
    if (lastUploadDate !== today) {
      user.dailyVideoUploads = 0;
    }

    // 計算每日上傳限制（與圖片一致的等級制）
    const hasVIP = user.subscriptions?.some(
      sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
    );
    
    // 使用與圖片相同的等級制計算
    const userPoints = user.totalEarnedPoints || 0;
    let levelIndex = 0;
    const levelThresholds = [0, 150, 500, 1000, 2000, 3500, 5000, 7000, 9000, 10000];
    for (let i = 0; i < levelThresholds.length; i++) {
      if (userPoints >= levelThresholds[i]) levelIndex = i;
    }
    
    const baseDailyLimit = 5 + levelIndex; // LV1=5, LV2=6, ..., LV10=14
    const dailyLimit = hasVIP ? 20 : baseDailyLimit;

    // 檢查是否已達上限
    if (user.dailyVideoUploads >= dailyLimit) {
      return NextResponse.json({ 
        error: `今日上傳已達上限（${dailyLimit}部）`,
        dailyLimit,
        currentCount: user.dailyVideoUploads,
        resetInfo: '明天 00:00 重置配額',
        isVIP: hasVIP
      }, { status: 429 });
    }

    // 解析表單資料
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title');
    const description = formData.get('description');
    const tags = formData.get('tags');
    
    // ✅ AI 生成元數據
    const platform = formData.get('platform') || '';
    const prompt = formData.get('prompt') || '';
    const negativePrompt = formData.get('negativePrompt') || '';
    const modelName = formData.get('modelName') || '';
    const modelLink = formData.get('modelLink') || '';
    
    // ✅ 生成參數
    const fps = formData.get('fps') ? Number(formData.get('fps')) : null;
    const resolution = formData.get('resolution') || '';
    const width = formData.get('width') ? Number(formData.get('width')) : 1920;
    const height = formData.get('height') ? Number(formData.get('height')) : 1080;
    const steps = formData.get('steps') ? Number(formData.get('steps')) : null;
    const cfgScale = formData.get('cfgScale') ? Number(formData.get('cfgScale')) : null;
    const seed = formData.get('seed') || '';
    
    // ✅ 分級與分類 - 統一使用與圖片一致的評級系統
    const rating = formData.get('rating') || 'sfw';
    const category = formData.get('category') || '';

    if (!file) {
      return NextResponse.json({ error: '請選擇影片檔案' }, { status: 400 });
    }

    // 檢查檔案類型
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支援的影片格式' }, { status: 400 });
    }

    // 檢查檔案大小 (20MB 限制，適合10-20秒短影片)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '影片檔案過大，請選擇小於 20MB 的檔案（建議 10-20 秒短影片）' }, { status: 400 });
    }

    // 生成檔案名稱
    const timestamp = Date.now();
    const fileName = `videos/${user._id}/${timestamp}-${file.name}`;

    // 上傳到 R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(uploadCommand);

    // 生成公開 URL
    const videoUrl = `${R2_PUBLIC_URL}/${fileName}`;

    // ✅ 獲取當前最高分數（用於計算 initialBoost）
    const topVideo = await Video.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
    const topScore = topVideo?.popScore || 0;
    const initialBoost = computeVideoInitialBoostFromTop(topScore);

    // ✅ 建立影片文檔
    const videoDoc = {
      title: title || '未命名影片',
      description: description || '',
      tags: tags ? tags.split(/[,\s]+/).map(tag => tag.trim()).filter(t => t) : [],
      videoUrl,
      thumbnailUrl: '', // 稍後會自動生成
      duration: 0, // 稍後會自動計算
      author: user._id,
      authorName: user.username,
      authorAvatar: user.image || '',
      likes: [],
      likesCount: 0,
      views: 0,
      clicks: 0,
      
      // ✅ AI 生成元數據
      platform,
      prompt,
      negativePrompt,
      modelName,
      modelLink,
      
      // ✅ 生成參數
      fps,
      resolution,
      width,
      height,
      steps,
      cfgScale,
      seed,
      
      // ✅ 分級與分類
      rating,
      category,
      
      // ✅ 計算完整度
      completenessScore: 0,
      hasMetadata: false,
      popScore: 0,
      initialBoost,
      
      uploadDate: new Date(),
      isPublic: true,
    };

    // ✅ 計算完整度
    videoDoc.completenessScore = computeVideoCompleteness(videoDoc);
    videoDoc.hasMetadata = videoDoc.completenessScore >= 30; // 30分以上視為有元數據
    
    // ✅ 計算初始熱門度分數
    videoDoc.popScore = computeVideoPopScore(videoDoc);
    
    // 儲存到資料庫
    const video = new Video(videoDoc);
    await video.save();

    // ===== 更新用戶每日上傳計數 =====
    user.dailyVideoUploads = (user.dailyVideoUploads || 0) + 1;
    user.lastVideoUploadDate = new Date();
    await user.save();

    return NextResponse.json({
      success: true,
      video: {
        id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        completenessScore: video.completenessScore,
        hasMetadata: video.hasMetadata,
      },
      dailyUploads: {
        current: user.dailyVideoUploads,
        limit: dailyLimit,
        remaining: dailyLimit - user.dailyVideoUploads
      },
      message: '影片上傳成功！'
    });

  } catch (error) {
    console.error('影片上傳失敗:', error);
    return NextResponse.json({ error: '影片上傳失敗' }, { status: 500 });
  }
}

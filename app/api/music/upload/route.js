import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { dbConnect } from '@/lib/db';
import Music from '@/models/Music';
import { computeMusicCompleteness, computeMusicInitialBoostFromTop } from '@/utils/scoreMusic';

export async function POST(request) {
  try {
    // 驗證用戶
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 連接資料庫
    await dbConnect();

    // 解析表單資料
    const formData = await request.formData();
    const file = formData.get('file');
    const title = formData.get('title');
    const description = formData.get('description');
    const tags = formData.get('tags');
    
    // ✅ AI 生成元數據
    const platform = formData.get('platform') || '';
    const prompt = formData.get('prompt') || '';
    const modelName = formData.get('modelName') || '';
    const modelLink = formData.get('modelLink') || '';
    
    // ✅ 音樂屬性
    const genre = formData.get('genre') || '';
    const mood = formData.get('mood') || '';
    const tempo = formData.get('tempo') ? Number(formData.get('tempo')) : null;
    const key = formData.get('key') || '';
    
    // ✅ 生成參數
    const seed = formData.get('seed') || '';
    
    // ✅ 分級與分類
    const rating = formData.get('rating') || 'all';
    const category = formData.get('category') || '';

    if (!file) {
      return NextResponse.json({ error: '請選擇音樂檔案' }, { status: 400 });
    }

    // 檢查檔案類型
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支援的音樂格式' }, { status: 400 });
    }

    // 檢查檔案大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '音樂檔案過大，請選擇小於 10MB 的檔案（建議 2-5 分鐘）' }, { status: 400 });
    }

    // 生成檔案名稱
    const timestamp = Date.now();
    const fileName = `music/${user._id}/${timestamp}-${file.name}`;

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
    const musicUrl = `${R2_PUBLIC_URL}/${fileName}`;

    // ✅ 獲取當前最高分數（用於計算 initialBoost）
    const topMusic = await Music.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
    const topScore = topMusic?.popScore || 0;
    const initialBoost = computeMusicInitialBoostFromTop(topScore);

    // ✅ 建立音樂文檔
    const musicDoc = {
      title: title || '未命名音樂',
      description: description || '',
      tags: tags ? tags.split(/[,\s]+/).map(tag => tag.trim()).filter(t => t) : [],
      musicUrl,
      coverImageUrl: '', // 稍後可以自動生成或用戶上傳
      duration: 0, // 稍後會自動計算
      author: user._id,
      authorName: user.username,
      authorAvatar: user.image || '',
      likes: [],
      likesCount: 0,
      plays: 0,
      clicks: 0,
      
      // ✅ AI 生成元數據
      platform,
      prompt,
      modelName,
      modelLink,
      
      // ✅ 音樂屬性
      genre,
      mood,
      tempo,
      key,
      
      // ✅ 生成參數
      seed,
      format: file.type.split('/')[1], // 從 MIME type 提取
      
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
    musicDoc.completenessScore = computeMusicCompleteness(musicDoc);
    musicDoc.hasMetadata = musicDoc.completenessScore >= 30; // 30分以上視為有元數據
    
    // 儲存到資料庫
    const music = new Music(musicDoc);
    await music.save();

    return NextResponse.json({
      success: true,
      music: {
        id: music._id,
        title: music.title,
        musicUrl: music.musicUrl,
        coverImageUrl: music.coverImageUrl,
        completenessScore: music.completenessScore,
        hasMetadata: music.hasMetadata,
      },
      message: '音樂上傳成功！'
    });

  } catch (error) {
    console.error('音樂上傳失敗:', error);
    return NextResponse.json({ error: '音樂上傳失敗' }, { status: 500 });
  }
}



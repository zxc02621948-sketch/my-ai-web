import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { generateR2Key, R2_PUBLIC_URL } from '@/lib/r2';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const dynamic = 'force-dynamic';

// ✅ 使用 AWS SDK 生成 presigned URL（與 Cloudflare R2 官方文檔一致）
async function generatePresignedUrl(key, contentType) {
  // ✅ 優先使用 AWS_ 前綴的環境變數（與 AWS CLI 一致）
  // 如果不存在，則回退到 R2_ 前綴（向後兼容）
  // 🔴 關鍵：使用 .trim() 去除可能的空白/換行污染
  const rawAccessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const rawSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const accessKeyId = rawAccessKeyId ? rawAccessKeyId.trim() : null;
  const secretAccessKey = rawSecretAccessKey ? rawSecretAccessKey.trim() : null;
  const bucket = process.env.R2_BUCKET_NAME;
  const accountId = process.env.R2_ACCOUNT_ID;
  
  // ✅ 檢查是否有 session token（臨時憑證）
  const sessionToken = process.env.AWS_SESSION_TOKEN || process.env.R2_SESSION_TOKEN;
  
  // ✅ 驗證：必須有 accessKeyId 和 secretAccessKey
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('❌ 缺少必要的憑證：R2_ACCESS_KEY_ID 或 R2_SECRET_ACCESS_KEY 未設置');
  }

  // ✅ 使用 AWS SDK 生成 presigned URL（與 Cloudflare R2 官方文檔一致）
  // 🔴 關鍵：使用 S3Client + PutObjectCommand + getSignedUrl，不要手動計算簽名
  const s3Client = new S3Client({
    region: 'us-east-1', // ✅ 使用固定 region（us-east-1）
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`, // ✅ 使用 account endpoint
    credentials: {
      accessKeyId: accessKeyId.trim(), // ✅ 再次 trim 確保沒有空白
      secretAccessKey: secretAccessKey.trim(), // ✅ 再次 trim 確保沒有空白
      ...(sessionToken && { sessionToken: sessionToken.trim() }), // ✅ 如果有 session token，也 trim
    },
    // ✅ 先維持當前的 addressing style（不設置 forcePathStyle，讓 SDK 自動選擇）
  });

  // ✅ 創建 PutObjectCommand
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // ✅ 生成 presigned URL（10 分鐘有效期）
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
  
  // ✅ 驗證：確保不使用自訂網域（presigned URL 不能用自訂網域）
  if (presignedUrl.includes('media.aicreateaworld.com') || presignedUrl.includes('aicreateaworld.com')) {
    throw new Error(`❌ Presigned URL 不能使用自訂網域，必須使用 S3 API domain: ${presignedUrl.substring(0, 100)}...`);
  }
  
  // ✅ 返回 URL（由 AWS SDK 生成，格式與 Cloudflare R2 官方文檔一致）
  return presignedUrl;
}

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { filename, contentType, fileSize, ...metadata } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ success: false, error: "缺少參數" }, { status: 400 });
    }

    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ success: false, error: '不支援的影片格式' }, { status: 400 });
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxSize) {
      return NextResponse.json({ success: false, error: '影片檔案過大，請選擇小於 100MB 的檔案' }, { status: 400 });
    }

    const key = generateR2Key(user._id.toString(), "videos", filename);

    // ✅ 生成 Presigned URL
    const presignedUrl = await generatePresignedUrl(key, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ 
      success: true, 
      uploadUrl: presignedUrl, 
      publicUrl,
      key,
      contentType, // ✅ 返回 contentType，前端需要使用相同的 Content-Type
      metadata 
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

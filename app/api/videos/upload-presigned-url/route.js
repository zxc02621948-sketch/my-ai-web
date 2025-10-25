import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { generateR2Key, R2_PUBLIC_URL } from '@/lib/r2';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// 手動生成 AWS Signature V4 presigned URL
function generatePresignedUrl(key, contentType) {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const region = 'auto';
  const bucket = process.env.R2_BUCKET_NAME;
  
  // 解析 endpoint URL
  const endpointUrl = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const endpointHost = endpointUrl.replace(/^https?:\/\//, '').split('/')[0];
  
  const now = new Date();
  const dateTime = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = now.toISOString().substring(0, 10).replace(/-/g, '');
  
  // URI 編碼 key，但保留 / 符號
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
  // S3 path style: /bucket/key
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const canonicalQuerystring = '';
  const canonicalHeaders = `host:${endpointHost}\ncontent-type:${contentType}\n`;
  const signedHeaders = 'host;content-type';
  const hashedPayload = 'UNSIGNED-PAYLOAD';
  
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    dateTime,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': dateTime,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': signedHeaders,
    'X-Amz-Signature': signature,
  });
  
  // 返回 URL: endpoint/bucket/key
  return `${endpointUrl}/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}?${queryParams.toString()}`;
}

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType, fileSize, ...metadata } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: '不支援的影片格式' }, { status: 400 });
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxSize) {
      return NextResponse.json({ error: '影片檔案過大，請選擇小於 100MB 的檔案' }, { status: 400 });
    }

    const key = generateR2Key(user._id.toString(), 'videos', filename);

    // 生成 Presigned URL
    const presignedUrl = generatePresignedUrl(key, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log('Generated presigned URL:', {
      key,
      contentType,
      uploadUrl: presignedUrl.substring(0, 100) + '...',
      publicUrl,
    });

    return NextResponse.json({
      success: true,
      uploadUrl: presignedUrl,
      publicUrl: publicUrl,
      key: key,
      metadata: metadata,
    });
  } catch (error) {
    console.error('Presigned URL 生成錯誤:', error);
    return NextResponse.json({ error: '生成上傳 URL 失敗' }, { status: 500 });
  }
}

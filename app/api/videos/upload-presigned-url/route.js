import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { generateR2Key, R2_PUBLIC_URL } from '@/lib/r2';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ✅ Secret 診斷函數（安全版，不會洩漏完整 secret）
function secretDiag(s) {
  const raw = s ?? "";
  const trimmed = raw.trim();
  const hasLeadingSpace = raw.length > 0 && raw[0] !== trimmed[0];
  const hasTrailingSpace = raw.length > 0 && raw[raw.length - 1] !== trimmed[trimmed.length - 1];
  const hasAnyWhitespace = /\s/.test(raw);
  const hasQuotes = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
  const show = (x) => (x.length <= 8 ? x : `${x.slice(0, 4)}...${x.slice(-4)}`);

  return {
    rawLen: raw.length,
    trimmedLen: trimmed.length,
    hasAnyWhitespace,
    hasLeadingSpace,
    hasTrailingSpace,
    hasQuotes,
    headTail_raw: show(raw),
    headTail_trimmed: show(trimmed),
  };
}

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
  
  // ✅ 計算憑證指紋（用於診斷，不會洩漏完整 secret）
  const accessKeyTail = accessKeyId ? accessKeyId.slice(-6) : 'MISSING';
  const secretHash8 = secretAccessKey 
    ? crypto.createHash('sha256').update(secretAccessKey).digest('hex').substring(0, 8)
    : 'MISSING';
  
  // ✅ 記錄憑證來源（用於診斷）
  const credentialSource = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'AWS_ACCESS_KEY_ID' : (process.env.R2_ACCESS_KEY_ID ? 'R2_ACCESS_KEY_ID' : 'MISSING'),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'AWS_SECRET_ACCESS_KEY' : (process.env.R2_SECRET_ACCESS_KEY ? 'R2_SECRET_ACCESS_KEY' : 'MISSING'),
    sessionToken: sessionToken ? (process.env.AWS_SESSION_TOKEN ? 'AWS_SESSION_TOKEN' : 'R2_SESSION_TOKEN') : null,
  };
  
  // ✅ Secret 診斷（檢查空白/引號/換行污染）
  const secretDiagnostics = secretDiag(rawSecretAccessKey);
  const accessKeyDiagnostics = secretDiag(rawAccessKeyId);
  
  console.log('🔍 憑證指紋（用於診斷）:', {
    accessKeyTail, // ✅ 只顯示後 6 碼
    secretHash8,   // ✅ 只顯示 hash 前 8 碼
    credentialSource, // ✅ 顯示使用的環境變數名稱
    accessKeyIdLength: accessKeyId?.length || 0,
    secretAccessKeyLength: secretAccessKey?.length || 0,
    hasSessionToken: !!sessionToken, // ✅ 檢查是否有 session token
  });
  
  console.log('🔍 R2 Credentials 診斷:', {
    accessKeyId_tail: accessKeyId?.slice(-6) || 'MISSING',
    accessKeyId_diag: accessKeyDiagnostics,
    secretDiag: secretDiagnostics,
    sessionToken_present: !!sessionToken,
  });
  
  // ✅ 如果發現問題，輸出警告
  if (secretDiagnostics.hasAnyWhitespace || secretDiagnostics.hasQuotes) {
    console.warn('⚠️ Secret Key 可能有格式問題:', {
      hasAnyWhitespace: secretDiagnostics.hasAnyWhitespace,
      hasLeadingSpace: secretDiagnostics.hasLeadingSpace,
      hasTrailingSpace: secretDiagnostics.hasTrailingSpace,
      hasQuotes: secretDiagnostics.hasQuotes,
      solution: '請檢查 .env.local 中的 R2_SECRET_ACCESS_KEY，確保沒有引號、空白或換行',
    });
  }
  
  if (accessKeyDiagnostics.hasAnyWhitespace || accessKeyDiagnostics.hasQuotes) {
    console.warn('⚠️ Access Key 可能有格式問題:', {
      hasAnyWhitespace: accessKeyDiagnostics.hasAnyWhitespace,
      hasLeadingSpace: accessKeyDiagnostics.hasLeadingSpace,
      hasTrailingSpace: accessKeyDiagnostics.hasTrailingSpace,
      hasQuotes: accessKeyDiagnostics.hasQuotes,
      solution: '請檢查 .env.local 中的 R2_ACCESS_KEY_ID，確保沒有引號、空白或換行',
    });
  }
  
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
  
  // ✅ 比對提示（用於快速診斷）
  const expectedAccessKeyTail = 'cf2844'; // AWS CLI 使用的 Access Key 尾碼
  const expectedSecretHash8 = 'c52de357'; // AWS CLI 使用的 Secret Key hash
  const credentialsMatch = accessKeyTail === expectedAccessKeyTail && secretHash8 === expectedSecretHash8;
  
  console.log('✅ Presigned URL 生成（使用 AWS SDK）:', {
    // ✅ 憑證指紋（用於診斷，不會洩漏完整 secret）
    accessKeyTail, // ✅ 只顯示後 6 碼（預期: cf2844）
    secretHash8,   // ✅ 只顯示 hash 前 8 碼（預期: c52de357）
    credentialSource, // ✅ 顯示使用的環境變數名稱
    credentialsMatch: credentialsMatch ? '✅ 與 AWS CLI 一致' : '❌ 與 AWS CLI 不一致', // ✅ 比對結果
    // ✅ 其他信息
    bucket,
    accountId: accountId ? 'SET' : 'MISSING',
    key,
    contentType,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'us-east-1', // ✅ 使用固定 region（us-east-1）
    expiresIn: 600, // 10 分鐘
    urlPreview: presignedUrl.substring(0, 120) + '...',
  });
  
  // ✅ 完整打印 presigned URL（用於 curl 測試，不要截斷）
  // 🔴 關鍵：前端必須使用這個完整的 fullUploadUrl，不能用截斷的 uploadUrl
  console.log("FULL_PRESIGNED_URL_START");
  console.log(presignedUrl);
  console.log("FULL_PRESIGNED_URL_END");
  
  // ✅ 如果憑證不匹配，輸出警告
  if (!credentialsMatch) {
    console.warn('⚠️ 憑證不匹配警告:', {
      message: '後端使用的憑證與 AWS CLI 不一致',
      expected: {
        accessKeyTail: expectedAccessKeyTail,
        secretHash8: expectedSecretHash8,
      },
      actual: {
        accessKeyTail,
        secretHash8,
      },
      solution: [
        '1. 檢查 .env.local 中的 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY',
        '2. 統一使用 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（與 AWS CLI 一致）',
        '3. 重啟 Next.js dev server（環境變數需要重啟才能生效）',
      ],
    });
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

    // ✅ 生成 Presigned URL（使用檢測到的 region）
    const presignedUrl = await generatePresignedUrl(key, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log('Generated presigned URL:', {
      key,
      contentType,
      uploadUrl: presignedUrl.substring(0, 100) + '...',
      publicUrl,
      fullUploadUrl: presignedUrl, // 完整 URL 用於調試
    });

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

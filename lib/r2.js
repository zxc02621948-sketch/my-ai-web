// Cloudflare R2 配置（S3 相容）
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// 初始化 R2 客戶端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// ✅ Export for direct use in API routes
export const s3Client = r2Client;
export const R2_BUCKET_NAME = BUCKET_NAME;

// 使用自定義域名
export const R2_PUBLIC_URL = 'https://media.aicreateaworld.com';

/**
 * 上傳檔案到 R2
 * @param {Buffer} fileBuffer - 檔案緩衝區
 * @param {string} key - 檔案路徑/名稱
 * @param {string} contentType - MIME 類型
 * @returns {Promise<string>} 檔案 URL
 */
export async function uploadToR2(fileBuffer, key, contentType) {
  try {
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        // R2 不支援 S3 ACL，需要在 Bucket 層級設定公開存取
      },
    });

    await upload.done();

    // 返回公開 URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('R2 上傳錯誤:', error);
    throw new Error('檔案上傳失敗');
  }
}

/**
 * 從 R2 刪除檔案
 * @param {string} key - 檔案路徑/名稱
 */
export async function deleteFromR2(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('R2 刪除錯誤:', error);
    throw new Error('檔案刪除失敗');
  }
}

/**
 * 生成檔案路徑
 * @param {string} userId - 用戶 ID
 * @param {string} type - 檔案類型 (video/music)
 * @param {string} filename - 原始檔名
 * @returns {string} R2 儲存路徑
 */
export function generateR2Key(userId, type, filename) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = filename.split('.').pop();
  
  return `${type}/${userId}/${timestamp}-${randomString}.${extension}`;
}

export default r2Client;


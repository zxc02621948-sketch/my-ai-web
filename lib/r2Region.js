// R2 Bucket Region 檢測與緩存
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

// ✅ Region Cache（避免每次都 HeadBucket）
let cachedRegion = null;
let cachedAt = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小時（毫秒）

/**
 * 獲取 R2 Bucket 的實際 Region
 * @param {string} bucketName - Bucket 名稱
 * @returns {Promise<string>} Region（例如 "APAC", "us-east-1"）
 */
export async function getR2BucketRegion(bucketName) {
  // ✅ 檢查緩存是否有效
  const now = Date.now();
  if (cachedRegion && (now - cachedAt) < CACHE_TTL) {
    console.log(`[R2Region] 使用緩存的 region: ${cachedRegion}`);
    return cachedRegion;
  }

  console.log(`[R2Region] 緩存過期或不存在，開始檢測 bucket region: ${bucketName}`);

  try {
    // ✅ 創建臨時 S3Client 用於 HeadBucket（可以用任意 region，因為只是為了獲取 BucketRegion）
    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('R2_ACCOUNT_ID 環境變數未設置');
    }

    const tempClient = new S3Client({
      region: 'us-east-1', // 臨時 region，HeadBucket 可以用任意 region
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true, // ✅ 固定使用 path-style，最穩
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    // ✅ 調用 HeadBucket 獲取 BucketRegion
    const command = new HeadBucketCommand({
      Bucket: bucketName,
    });

    const response = await tempClient.send(command);
    
    // ✅ 從響應中提取 BucketRegion
    // HeadBucket 的響應會在 $metadata.httpHeaders 中包含 x-amz-bucket-region
    // 或者直接在 response 中（取決於 SDK 版本）
    // 注意：R2 可能使用不同的 header 名稱
    const bucketRegion = 
      response.BucketRegion || 
      response.$metadata?.httpHeaders?.['x-amz-bucket-region'] ||
      response.$metadata?.httpHeaders?.['X-Amz-Bucket-Region'] ||
      response.$metadata?.httpHeaders?.['x-r2-bucket-region'] ||
      response.$metadata?.httpHeaders?.['X-R2-Bucket-Region'];
    
    if (!bucketRegion) {
      // ✅ 如果 HeadBucket 沒有返回 region，記錄響應結構以便調試
      console.warn('[R2Region] HeadBucket 未返回 BucketRegion');
      console.warn('[R2Region] 響應結構:', {
        hasResponse: !!response,
        metadata: response?.$metadata,
        headers: response?.$metadata?.httpHeaders,
      });
      
      // ✅ 嘗試使用環境變數中的備選 region（如果設置了）
      const fallbackRegion = process.env.R2_BUCKET_REGION || 'us-east-1';
      console.warn(`[R2Region] 使用備選 region: ${fallbackRegion}（可通過 R2_BUCKET_REGION 環境變數設置）`);
      cachedRegion = fallbackRegion;
    } else {
      cachedRegion = bucketRegion;
      console.log(`[R2Region] ✅ 檢測到 bucket region: ${bucketRegion}`);
    }

    // ✅ 更新緩存時間
    cachedAt = Date.now();

    return cachedRegion;
  } catch (error) {
    console.error('[R2Region] HeadBucket 失敗:', error);
    
    // ✅ 如果 HeadBucket 失敗，使用默認 region（避免完全無法工作）
    if (!cachedRegion) {
      console.warn('[R2Region] 使用默認 region: us-east-1');
      cachedRegion = 'us-east-1';
      cachedAt = Date.now();
    }
    
    return cachedRegion;
  }
}

/**
 * 清除 Region 緩存（用於測試或強制刷新）
 */
export function clearR2RegionCache() {
  cachedRegion = null;
  cachedAt = 0;
  console.log('[R2Region] 緩存已清除');
}


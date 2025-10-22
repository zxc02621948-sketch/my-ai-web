// 測試 R2 連接的 API
import { NextResponse } from 'next/server';
import { uploadToR2, generateR2Key } from '@/lib/r2';

export async function GET() {
  try {
    // 檢查環境變數
    const requiredEnvVars = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_ENDPOINT'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      return NextResponse.json({
        success: false,
        error: '缺少環境變數',
        missing: missingVars
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'R2 配置正確！',
      config: {
        bucket: process.env.R2_BUCKET_NAME,
        endpoint: process.env.R2_ENDPOINT,
        publicUrl: process.env.R2_PUBLIC_URL || '(未設定)'
      }
    });

  } catch (error) {
    console.error('R2 測試錯誤:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// 測試上傳
export async function POST() {
  try {
    // 創建一個簡單的測試檔案
    const testContent = `測試檔案 - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');
    
    const key = generateR2Key('test-user', 'test', 'test.txt');
    const url = await uploadToR2(testBuffer, key, 'text/plain');

    return NextResponse.json({
      success: true,
      message: '測試上傳成功！',
      key,
      url
    });

  } catch (error) {
    console.error('R2 測試上傳錯誤:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}





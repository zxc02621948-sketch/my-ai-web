import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message, data } = await request.json();
    
    // 輸出到服務器終端
    console.log(`🔍 [前端日誌] ${message}`, data || '');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('記錄前端日誌失敗:', error);
    return NextResponse.json({ error: '記錄失敗' }, { status: 500 });
  }
}



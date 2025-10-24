import { NextResponse } from 'next/server';

// 測試用的 API 路由
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: 'File received successfully'
    });
    
  } catch (error) {
    console.error('Test upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error.message 
    }, { status: 500 });
  }
}

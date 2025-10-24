import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Simple test API called');
    
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ 
        error: 'No file provided',
        details: 'FormData is empty'
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      message: 'File received successfully'
    });
    
  } catch (error) {
    console.error('Simple test error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

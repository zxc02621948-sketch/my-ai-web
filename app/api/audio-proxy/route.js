import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    
    if (!url) {
      return NextResponse.json({ error: "缺少 url 參數" }, { status: 400 });
    }

    // 驗證是否為 YouTube URL
    try {
      const urlObj = new URL(url);
      const isYouTube = /youtube\.com|youtu\.be/.test(urlObj.hostname);
      if (!isYouTube) {
        return NextResponse.json({ error: "僅支援 YouTube 連結" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "無效的 URL" }, { status: 400 });
    }

    // 對於 YouTube URL，返回錯誤信息，建議使用 YouTube 播放器
    return NextResponse.json({ 
      error: "YouTube 音頻需要特殊的播放器支持，請使用 YouTube 播放器組件",
      requiresYouTubePlayer: true,
      originalUrl: url
    }, { 
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error("音頻代理錯誤:", error);
    return NextResponse.json({ 
      error: "音頻代理失敗" 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

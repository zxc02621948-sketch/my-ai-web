export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url") || "";
    if (!url) {
      return NextResponse.json({ error: "缺少 url 參數" }, { status: 400 });
    }
    // 呼叫 YouTube oEmbed 以取得公開影片標題
    const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!oembed.ok) {
      return NextResponse.json({ error: `oEmbed 錯誤 ${oembed.status}` }, { status: 502 });
    }

    const data = await oembed.json();
    return NextResponse.json({
      title: data?.title || null,
      author_name: data?.author_name || null,
      author_url: data?.author_url || null,
      thumbnail_url: data?.thumbnail_url || null,
    }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "oEmbed 代理失敗" }, { status: 500 });
  }
}
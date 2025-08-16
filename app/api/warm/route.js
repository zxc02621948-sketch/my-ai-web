// app/api/warm/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

function ok(status = 204) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  if (process.env.WARM_TOKEN && t !== process.env.WARM_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try { await dbConnect(); } catch { /* 即使失敗也不讓監控誤判 */ }
  return ok();
}

export async function HEAD(req) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t");
  if (process.env.WARM_TOKEN && t !== process.env.WARM_TOKEN) return ok(401);
  return ok();
}

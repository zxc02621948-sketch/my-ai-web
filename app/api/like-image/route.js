// app/api/like-image/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

function computePopScore(img) {
  const W_CLICK = 1.0;
  const W_LIKE = 2.0;
  const W_COMPLETE = 0.05;
  const TIMEBOOST_MAX = 10;

  const now = Date.now();
  const created = new Date(img.createdAt || now).getTime();
  const hoursSince = Math.max(0, (now - created) / 36e5);
  const timeBoost = Math.max(0, TIMEBOOST_MAX - hoursSince);

  const clicks = Number(img.clicks || 0);
  const likesCount = Number(img.likesCount ?? (Array.isArray(img.likes) ? img.likes.length : 0));
  const comp = Number(img.completenessScore || 0);

  return clicks * W_CLICK + likesCount * W_LIKE + comp * W_COMPLETE + timeBoost;
}

function getUserIdFromAuth(req) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || decoded?._id || null;
  } catch {
    return null;
  }
}

export async function PUT(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const userId = getUserIdFromAuth(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const img = await Image.findById(id);
    if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const had = (img.likes || []).some((x) => String(x) === String(userId));
    if (had) {
      img.likes = (img.likes || []).filter((x) => String(x) !== String(userId));
    } else {
      img.likes = [...(img.likes || []), userId];
    }

    img.likesCount = Array.isArray(img.likes) ? img.likes.length : 0;
    img.popScore = computePopScore(img);
    await img.save();

    return NextResponse.json({
      ok: true,
      _id: img._id.toString(),
      likes: img.likes,
      likesCount: img.likesCount,
      popScore: img.popScore,
    });
  } catch (err) {
    console.error("❌ like-image 失敗:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

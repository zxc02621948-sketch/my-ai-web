// app/api/like-image/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import jwt from "jsonwebtoken";
import { computePopScore, ensureLikesCount } from "@/utils/score";

export const dynamic = "force-dynamic";

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

    img.likesCount = ensureLikesCount(img);
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

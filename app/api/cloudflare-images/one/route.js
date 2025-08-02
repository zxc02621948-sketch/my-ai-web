// app/api/cloudflare-images/one/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";
import mongoose from "mongoose"; // ✅ 新增

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
  }

  // ✅ 加入格式驗證
  if (!mongoose.Types.ObjectId.isValid(imageId)) {
    return NextResponse.json({ error: "Invalid imageId format" }, { status: 400 });
  }

  try {
    const image = await Image.findById(imageId);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json({ image });
  } catch (error) {
    console.error("❌ get image error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

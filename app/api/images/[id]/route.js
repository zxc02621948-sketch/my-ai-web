// /app/api/images/[id]/route.js
import { dbConnect } from "@/lib/db";
import ImageModel from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET(_, context) {
  try {
    await dbConnect();
    const id = (await context.params).id;

    // ✅ 這行一定要有！
    const image = await ImageModel.findById(id).populate("user");

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({ image });
  } catch (error) {
    console.error("❌ route.js 發生錯誤：", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// /api/user-images/[id]/liked/route.js
import { connectToDB } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET(req, ctx) {
  await connectToDB();
  const params = await ctx.params;
  const images = await Image.find({ likes: params.id }).sort({ createdAt: -1 });
  return NextResponse.json(images);
}

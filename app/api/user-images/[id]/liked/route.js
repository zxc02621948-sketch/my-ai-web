// /api/user-images/[id]/liked/route.js
import { connectToDB } from "@/lib/mongoose";
import Image from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  await connectToDB();
  const images = await Image.find({ likes: params.id }).sort({ createdAt: -1 });
  return NextResponse.json(images);
}

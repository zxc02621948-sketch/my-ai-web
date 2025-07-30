// /api/user-images/[id]/uploaded/route.js
import { connectToDB } from "@/lib/mongoose";
import Image from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  await connectToDB();
  const images = await Image.find({ user: params.id }).sort({ createdAt: -1 });
  return NextResponse.json(images);
}

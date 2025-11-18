import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
  }

  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.db;
    const comments = await db
      .collection("comments")
      .find({ imageId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { imageId, text } = await request.json();

    if (!imageId || !text) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const mongoose = await dbConnect();
    const db = mongoose.connection.db;
    const newComment = {
      imageId,
      text,
      createdAt: new Date(),
    };

    await db.collection("comments").insertOne(newComment);

    return NextResponse.json({ message: "Comment added successfully" });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

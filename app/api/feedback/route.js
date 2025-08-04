// app/api/feedback/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

// ✅ GET：回傳所有回報（僅限管理員）
export async function GET(req) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUserFromRequest(req);

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: "無權限存取" }, { status: 403 });
    }

    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate("userId", "username email")
      .lean();

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error("載入回報失敗：", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// ✅ POST：建立一筆回報
export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const { type, message, pageUrl } = body;

    if (!type || !message) {
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
    }

    const currentUser = await getCurrentUserFromRequest(req);
    const userId = currentUser?._id || null;

    const newFeedback = await Feedback.create({
      type,
      message,
      pageUrl,
      userId,
    });

    return NextResponse.json({ success: true, feedback: newFeedback });
  } catch (error) {
    console.error("建立回報失敗：", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

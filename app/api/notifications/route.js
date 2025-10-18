// app/api/notifications/route.js
import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const notifications = await Notification.find({ userId: currentUser._id })
      .sort({ createdAt: -1 })
      .populate("fromUserId", "username image")
      .limit(30);

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("❌ 取得通知失敗：", error);
    return NextResponse.json({ error: "無法取得通知" }, { status: 500 });
  }
}

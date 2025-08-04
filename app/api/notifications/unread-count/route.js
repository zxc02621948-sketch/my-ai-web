// app/api/notifications/unread-count/route.js
import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ count: 0 });
    }

    const count = await Notification.countDocuments({
      userId: currentUser._id,
      isRead: false,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("🔴 無法取得未讀通知數：", error);
    return NextResponse.json({ count: 0 });
  }
}

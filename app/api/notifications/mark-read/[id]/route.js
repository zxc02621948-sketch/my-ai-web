// app/api/notifications/mark-read/[id]/route.js

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function PATCH(req, context) {
  try {
    await dbConnect();

    const id = (await context.params).id; // ✅ ✅ ✅ Edge Runtime 就是要這樣 await！

    await Notification.findByIdAndUpdate(id, { isRead: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ 錯誤：", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
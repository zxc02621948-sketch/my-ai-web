// app/api/notifications/[id]/route.js
import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { NextResponse } from "next/server";

export async function DELETE(_, contextPromise) {
  try {
    await dbConnect();
    const context = await contextPromise;
    const id = context.params.id;

    await Notification.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ 通知刪除失敗：", err);
    return NextResponse.json({ error: "無法刪除通知" }, { status: 500 });
  }
}

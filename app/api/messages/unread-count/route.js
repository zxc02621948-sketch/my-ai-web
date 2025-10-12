import Message from "@/models/Message";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Mongoose 只能跑在 Node 環境

export async function GET(req) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      return NextResponse.json({ ok: true, unread: 0 });
    }
    
    const n = await Message.countDocuments({ toId: currentUser._id, isRead: false });
    return NextResponse.json({ ok: true, unread: n }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("🔴 無法取得未讀消息數：", error);
    return NextResponse.json({ ok: true, unread: 0 });
  }
}

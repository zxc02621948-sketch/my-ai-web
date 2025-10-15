// /app/api/messages/thread/restore/route.js
import Message from "@/models/Message";
import mongoose from "mongoose";
import { requireUser } from "@/utils/auth";
import ArchivedThread from "@/models/ArchivedThread";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const me = await requireUser(req);
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "BAD_JSON" }), { status: 400 });
  }
  
  const { conversationId } = body || {};
  if (!conversationId) {
    return new Response(JSON.stringify({ ok: false, error: "MISSING_ID" }), { status: 400 });
  }

  const cid = String(conversationId);

  try {
    // 1) 從消息中移除 deletedFor
    const removeDeletedFor = { $pull: { deletedFor: { $in: [me._id, String(me._id)] } } };
    
    // 處理 pair 格式
    let matchQuery;
    if (cid.startsWith("pair:")) {
      matchQuery = { conversationId: cid };
    } else {
      // 處理舊格式
      matchQuery = { $or: [{ conversationId: cid }, { _id: cid }] };
    }

    const res1 = await Message.updateMany(matchQuery, removeDeletedFor);

    // 2) 從會話層級封存中移除
    await ArchivedThread.deleteOne({ userId: me._id, cid });

    return Response.json(
      { 
        ok: true, 
        cid, 
        matched: res1.matchedCount || res1.n || 0,
        modified: res1.modifiedCount || res1.nModified || 0
      }, 
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Restore thread error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "SERVER_ERROR" }), 
      { status: 500 }
    );
  }
}
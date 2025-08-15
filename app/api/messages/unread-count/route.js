import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Mongoose 只能跑在 Node 環境

export async function GET(req) {
  const me = await requireUser(req); // 內部已 await dbConnect()
  const n = await Message.countDocuments({ toId: me._id, isRead: false });
  return Response.json({ ok: true, unread: n }, { headers: { "cache-control": "no-store" } });
}

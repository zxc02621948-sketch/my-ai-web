import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await requireUser(req);
  const n = await Message.countDocuments({ toId: me._id, isRead: false });
  return Response.json({ ok: true, unread: n }, { headers: { "cache-control": "no-store" } });
}

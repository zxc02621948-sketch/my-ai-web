import Notification from "@/models/Notification";
import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const me = await requireUser(req);
  const { id } = await req.json();
  await Notification.updateOne({ _id: id, userId: me._id }, { $set: { isRead: true, readAt: new Date() } });
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

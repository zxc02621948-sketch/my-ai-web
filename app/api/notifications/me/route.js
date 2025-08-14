import Notification from "@/models/Notification";
import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await requireUser(req);
  const items = await Notification.find({ userId: me._id }).sort({ _id: -1 }).limit(100);
  return Response.json({ ok: true, items }, { headers: { "cache-control": "no-store" } });
}

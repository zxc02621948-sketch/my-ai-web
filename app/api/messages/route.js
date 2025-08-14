import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await requireUser(req);
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Number(searchParams.get("limit") || 20));

  const q = { toId: me._id };
  const [items, total] = await Promise.all([
    Message.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit),
    Message.countDocuments(q)
  ]);
  return Response.json({ ok: true, items, total, page, limit }, {
    headers: { "cache-control": "no-store" }
  });
}

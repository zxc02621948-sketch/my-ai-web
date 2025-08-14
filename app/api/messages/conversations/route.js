import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

function computeCid(m, meId) {
  if (m.conversationId) return String(m.conversationId);
  const me = String(meId);
  const to = String(m.toId);
  const from = m.fromId ? String(m.fromId) : null;
  let other;
  if (from === me) other = to;
  else if (to === me) other = from || "system";
  else other = from || to || "system";
  const pair = [me, String(other)].sort();
  return `pair:${pair[0]}:${pair[1]}`;
}

export async function GET(req) {
  const me = await requireUser(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 30)));
  const includeArchived = searchParams.get("includeArchived") === "1";

  const archiveFilter = includeArchived
    ? {} // 顯示封存
    : { $or: [{ deletedFor: { $exists: false } }, { deletedFor: { $ne: me._id } }] };

  const related = await Message.find({
    $and: [
      { $or: [{ toId: me._id }, { fromId: me._id }] },
      archiveFilter,
    ],
  })
    .sort({ createdAt: -1 })
    .limit(800)
    .lean();

  const map = new Map();
  for (const m of related) {
    const cid = computeCid(m, me._id);
    let g = map.get(cid);
    if (!g) {
      g = { cid, subject: m.subject, last: m, unread: 0 };
      map.set(cid, g);
    }
    if (!g.last || new Date(m.createdAt) > new Date(g.last.createdAt)) {
      g.last = m;
      if (!g.subject) g.subject = m.subject;
    }
    if (String(m.toId) === String(me._id) && !m.isRead) {
      g.unread = (g.unread || 0) + 1;
    }
  }

  const items = Array.from(map.values())
    .sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt))
    .slice(0, limit);

  return Response.json({ ok: true, items, limit }, { headers: { "cache-control": "no-store" } });
}

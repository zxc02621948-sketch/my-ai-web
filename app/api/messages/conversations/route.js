import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
import ArchivedThread from "@/models/ArchivedThread";

export const dynamic = "force-dynamic";

function computeCid(m, meId){
  if (m.conversationId) return String(m.conversationId);
  const me=String(meId);
  const to=String(m.toId);
  const from=m.fromId?String(m.fromId):null;
  const other = from===me ? to : (to===me ? (from||"system") : (from||to||"system"));
  const pair=[me,String(other)].sort();
  return `pair:${pair[0]}:${pair[1]}`;
}

export async function GET(req){
  const me = await requireUser(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 30)));
  const includeArchived = searchParams.get("includeArchived")==="1";
  const meIdStr = String(me._id);

  // ① 會話層級黑名單（真正來源）
  const archivedRows = await ArchivedThread.find({ userId: me._id }).select({ cid:1 }).lean();
  const archivedCids = new Set(archivedRows.map(r => String(r.cid)));

  // ② 訊息層級雙型別過濾（輔助；保留）
  const notArchivedMsg = includeArchived ? {} : {
    $or:[ { deletedFor:{ $exists:false } }, { deletedFor:{ $size:0 } }, { deletedFor:{ $nin:[me._id, meIdStr] } } ]
  };

  // ③ 取相關訊息後再以 computeCid 分組，最後一層用 archivedCids 過濾掉整串
  const related = await Message.find({
    $and: [ { $or:[{ toId: me._id }, { fromId: me._id }] }, notArchivedMsg ],
  }).sort({ createdAt: -1 }).limit(1000).lean();

  const map = new Map();
  for (const m of related) {
    const cid = computeCid(m, me._id);
    if (!includeArchived && archivedCids.has(cid)) continue; // 會話層級排除
    let g = map.get(cid);
    if (!g) g = { cid, subject: m.subject, last: m, unread: 0 }, map.set(cid, g);
    if (!g.last || new Date(m.createdAt) > new Date(g.last.createdAt)) {
      g.last = m; if (!g.subject) g.subject = m.subject;
    }
    if (String(m.toId)===meIdStr && !m.isRead) g.unread = (g.unread||0) + 1;
  }

  const items = Array.from(map.values())
    .sort((a,b)=> new Date(b.last.createdAt)-new Date(a.last.createdAt))
    .slice(0, limit);

  return Response.json({ ok:true, items, limit }, { headers:{ "cache-control":"no-store" } });
}

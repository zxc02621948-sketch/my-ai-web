import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
import ArchivedThread from "@/models/ArchivedThread";

export const dynamic = "force-dynamic";

export async function GET(req){
  const me = await requireUser(req);
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Number(searchParams.get("limit") || 20));
  const includeArchived = searchParams.get("includeArchived")==="1";
  const meIdStr = String(me._id);

  const archivedRows = await ArchivedThread.find({ userId: me._id }).select({ cid:1 }).lean();
  const archivedCids = new Set(archivedRows.map(r => String(r.cid)));

  const notArchivedMsg = includeArchived ? {} : {
    $or:[ { deletedFor:{ $exists:false } }, { deletedFor:{ $size:0 } }, { deletedFor:{ $nin:[me._id, meIdStr] } } ]
  };

  const q = { toId: me._id, ...notArchivedMsg };
  const all = await Message.find(q).sort({ createdAt:-1 }).limit(1000).lean();

  // 將已封存會話濾掉
  const items = includeArchived ? all : all.filter(m => {
    const cid = m.conversationId ? String(m.conversationId) : null;
    return !cid || !archivedCids.has(cid);
  });

  const total = items.length;
  const paged = items.slice((page-1)*limit, page*limit);

  return Response.json({ ok:true, items: paged, total, page, limit }, { headers:{ "cache-control":"no-store" } });
}

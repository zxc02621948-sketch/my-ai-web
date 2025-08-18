// /app/api/messages/thread/archive/route.js
import Message from "@/models/Message";
import mongoose from "mongoose";
import { requireUser } from "@/utils/auth";
import ArchivedThread from "@/models/ArchivedThread";

export const dynamic = "force-dynamic";

// ---- Utils（維持你既有的邏輯）----
function toObjIdOrSystem(x){ if(x==="system")return"system"; try{ return new mongoose.Types.ObjectId(x);}catch{ return x; } }
function computePairCid(a,b){ const [x,y]=[String(a),String(b)].sort(); return `pair:${x}:${y}`; }
function computeCidLike(m, meId){
  if (m.conversationId) return String(m.conversationId);
  const me=String(meId);
  const to=m.toId?String(m.toId):"system";
  const from=m.fromId?String(m.fromId):"system";
  const other = from===me ? to : (to===me ? from : (from||to||"system"));
  return computePairCid(me, other);
}
function buildFromToQuery(a,b){
  const isA=a==="system", isB=b==="system";
  const fromA_toB={ $and:[{ fromId:isA?null:a }, { toId:isB?null:b }] };
  const fromB_toA={ $and:[{ fromId:isB?null:b }, { toId:isA?null:a }] };
  const lax=[];
  if(isA) lax.push({ $and:[{ fromId:{ $exists:false } }, { toId:isB?null:b }] });
  if(isB) lax.push({ $and:[{ fromId:isA?null:a }, { toId:{ $exists:false } }] });
  return { $or:[fromA_toB, fromB_toA, ...lax] };
}

export async function POST(req){
  const me = await requireUser(req);
  let body; try{ body=await req.json(); }catch{ return new Response(JSON.stringify({ok:false,error:"BAD_JSON"}),{status:400}); }
  const { conversationId } = body||{};
  if(!conversationId) return new Response(JSON.stringify({ok:false,error:"MISSING_ID"}),{status:400});

  // 1) 收斂出唯一 cid
  let cid = String(conversationId);
  let fromToQuery = null;

  if (cid.startsWith("pair:")) {
    const [, aRaw, bRaw] = cid.split(":"); 
    fromToQuery = buildFromToQuery(toObjIdOrSystem(aRaw), toObjIdOrSystem(bRaw));
  } else {
    const seed = await Message.findOne({ $or:[{ conversationId: cid }, { _id: cid }] })
      .select({ fromId:1, toId:1, conversationId:1 }).lean();
    if (seed) {
      cid = computeCidLike(seed, me._id);
      const meStr=String(me._id);
      const other = String(seed.fromId||"")===meStr ? String(seed.toId||"system") : String(seed.fromId||"system");
      fromToQuery = buildFromToQuery(toObjIdOrSystem(meStr), toObjIdOrSystem(other));
    } else {
      const related = await Message.find({ $or:[{ toId: me._id }, { fromId: me._id }] })
        .select({ fromId:1, toId:1, conversationId:1 }).lean();
      for(const m of related){
        const guess = computeCidLike(m, me._id);
        if (guess===cid){
          const meStr=String(me._id);
          const other = String(m.fromId||"")===meStr ? String(m.toId||"system") : String(m.fromId||"system");
          fromToQuery = buildFromToQuery(toObjIdOrSystem(meStr), toObjIdOrSystem(other));
          break;
        }
      }
    }
  }

  // 2) 一網打盡：訊息層級封存 + 回填 conversationId
  const matchAll = fromToQuery ? { $or:[{ conversationId: cid }, fromToQuery] } : { conversationId: cid };
  const addDeletedFor = { $addToSet:{ deletedFor:{ $each:[me._id, String(me._id)] } } };

  const res1 = await Message.updateMany(matchAll, addDeletedFor);
  await Message.updateMany(
    { ...matchAll, $or:[{ conversationId:{ $exists:false } }, { conversationId:null }] },
    { $set:{ conversationId: cid } }
  );

  // 3) 第二道保險
  let matched=res1.matchedCount ?? res1.n ?? 0;
  let modified=res1.modifiedCount ?? res1.nModified ?? 0;
  if (matched===0 || modified===0){
    const related = await Message.find({ $or:[{ toId: me._id }, { fromId: me._id }] })
      .select({ _id:1, fromId:1, toId:1, conversationId:1 }).lean();
    const ids=[]; for(const m of related){ if (computeCidLike(m, me._id)===cid) ids.push(m._id); }
    if (ids.length){
      const res2 = await Message.updateMany({ _id:{ $in: ids } }, addDeletedFor);
      matched += res2.matchedCount ?? res2.n ?? 0;
      modified += res2.modifiedCount ?? res2.nModified ?? 0;
      await Message.updateMany(
        { _id:{ $in: ids }, $or:[{ conversationId:{ $exists:false } }, { conversationId:null }] },
        { $set:{ conversationId: cid } }
      );
    }
  }

  // 4) 會話層級封存：寫入黑名單
  await ArchivedThread.updateOne(
    { userId: me._id, cid },
    { $setOnInsert: { userId: me._id, cid, createdAt: new Date() } },
    { upsert: true }
  );

  return Response.json({ ok:true, cid, matched, modified }, { headers:{ "cache-control":"no-store" } });
}

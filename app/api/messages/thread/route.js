// app/api/messages/thread/route.js
import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

function pairCid(a, b) {
  const [x, y] = [String(a), String(b)].sort();
  return `pair:${x}:${y}`;
}
function parsePair(id) {
  if (!id?.startsWith("pair:")) return null;
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  return [parts[1], parts[2]];
}

// 允許 "system"；否則需為 24 位 ObjectId
function asObjectIdOrSystem(v) {
  if (!v || typeof v !== "string") return null;
  if (v === "system") return "system";
  return /^[0-9a-fA-F]{24}$/.test(v) ? new mongoose.Types.ObjectId(v) : null;
}

// 建出 from/to 的配對條件；當一端為 "system" 時，以 null 當對端欄位值
function buildPairFromToQuery(a, b) {
  const isA_sys = a === "system";
  const isB_sys = b === "system";

  const fromA_toB = { $and: [{ fromId: isA_sys ? null : a }, { toId: isB_sys ? null : b }] };
  const fromB_toA = { $and: [{ fromId: isB_sys ? null : b }, { toId: isA_sys ? null : a }] };

  const lax = [];
  if (isA_sys) {
    lax.push({ $and: [{ fromId: { $exists: false } }, { toId: isB_sys ? null : b }] });
  }
  if (isB_sys) {
    lax.push({ $and: [{ fromId: isA_sys ? null : a }, { toId: { $exists: false } }] });
  }
  return { $or: [fromA_toB, fromB_toA, ...lax] };
}

export async function GET(req) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const includeArchived = searchParams.get("includeArchived") === "1";
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: "MISSING_ID" }), { status: 400 });
    }

    const meIdStr = String(me._id);
    const pair = parsePair(id);
    let items = [];

    // ✅ 升級版封存過濾：同時排除 ObjectId 與字串型 userId，並處理空陣列/未設欄位
    const notArchivedFilter = includeArchived
      ? {}
      : {
          $or: [
            { deletedFor: { $exists: false } },
            { deletedFor: { $size: 0 } },
            { deletedFor: { $nin: [me._id, meIdStr] } },
          ],
        };

    if (pair) {
      // 1) 直接用 conversationId
      items = await Message.find({ $and: [{ conversationId: id }, notArchivedFilter] })
        .sort({ createdAt: 1 })
        .lean();

      // 2) 無資料 → 以 from/to 配對並回填 conversationId
      if (!items.length) {
        const [aRaw, bRaw] = pair;
        const a = asObjectIdOrSystem(aRaw);
        const b = asObjectIdOrSystem(bRaw);
        if (!a || !b) {
          return new Response(JSON.stringify({ ok: false, error: "INVALID_PAIR_IDS" }), {
            status: 400,
          });
        }

        const fromToQuery = buildPairFromToQuery(a, b);
        items = await Message.find({ $and: [fromToQuery, notArchivedFilter] })
          .sort({ createdAt: 1 })
          .lean();

        if (items.length) {
          const ids = items.map((m) => m._id);
          await Message.updateMany({ _id: { $in: ids } }, { $set: { conversationId: id } });
          items.forEach((m) => (m.conversationId = id));
        }
      }
    } else {
      // 非 pair：相容第一封即 _id
      items = await Message.find({
        $and: [{ $or: [{ conversationId: id }, { _id: id }] }, notArchivedFilter],
      })
        .sort({ createdAt: 1 })
        .lean();

      // 舊資料補 pairCid（若 first 無 conversationId）
      if (items.length && !items[0].conversationId) {
        const first = items[0];
        const otherId =
          String(first.fromId) === meIdStr ? String(first.toId) : String(first.fromId || "");
        const cid = pairCid(meIdStr, otherId || "system");
        await Message.updateMany(
          { $or: [{ _id: first._id }, { conversationId: String(first._id) }] },
          { $set: { conversationId: cid } }
        );
        items.forEach((m) => (m.conversationId = cid));
      }
    }

    // 是否被我封存（採任一則檢查）
    let archivedForMe = false;
    if (items.length) {
      const sample = await Message.findOne({ conversationId: items[0].conversationId })
        .select({ deletedFor: 1 })
        .lean();
      archivedForMe = !!(sample?.deletedFor?.some?.((x) => String(x) === meIdStr));
    } else if (includeArchived) {
      const force = await Message.find({ conversationId: id })
        .select({ _id: 1, deletedFor: 1 })
        .limit(1)
        .lean();
      archivedForMe = !!(force[0]?.deletedFor?.some?.((x) => String(x) === meIdStr));
    }

    // 標記已讀
    await Message.updateMany(
      {
        toId: me._id,
        isRead: false,
        $or: pair ? [{ conversationId: id }] : [{ conversationId: id }, { _id: id }],
      },
      { $set: { isRead: true, readAt: new Date() } }
    ).catch(() => {});

    return Response.json({ ok: true, items, archivedForMe }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || "SERVER_ERROR" }), {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}

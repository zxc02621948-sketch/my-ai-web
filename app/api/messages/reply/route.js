// /app/api/messages/reply/route.js
import Message from "@/models/Message";
import User from "@/models/User";
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
function asObjectIdMaybe(v) {
  if (!v || typeof v !== "string") return null;
  return /^[0-9a-fA-F]{24}$/.test(v) ? new mongoose.Types.ObjectId(v) : null;
}

const SUPPORT_USER_ID = process.env.SUPPORT_USER_ID || null;

export async function POST(req) {
  try {
    const me = await requireUser(req);
    const { conversationId, body } = await req.json();

    if (!conversationId || !body?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS" }), { status: 400 });
    }

    const meId = String(me._id);
    const pair = parsePair(conversationId);
    let toId = null;
    let subject = "";
    let ref = undefined;
    let convId = conversationId;

    if (pair) {
      // —— pair 會話：直接由配對得出「對方」
      const [aRaw, bRaw] = pair;
      const a = asObjectIdMaybe(aRaw);
      const b = asObjectIdMaybe(bRaw);
      if (!a || !b) {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_PAIR_IDS" }), { status: 400 });
      }
      const aStr = String(a);
      const bStr = String(b);
      const otherStr = meId === aStr ? bStr : aStr; // 若我不在 pair 內，就默認回 a
      toId = new mongoose.Types.ObjectId(otherStr);

      // 取這串的最後一封（若已有訊息可沿用主旨與 ref）
      const last = await Message.findOne({ conversationId }).sort({ createdAt: -1 }).lean();
      if (last) {
        subject = last.subject || "";
        ref = last.ref;
      } else {
        // 沒有任何訊息：主旨就先用空字串（或你想要的預設）
        subject = "";
      }
    } else {
      // —— 舊/一般會話：從 id 找到最後一封，推導對方與會話鍵
      const last = await Message.findOne({
        $or: [{ conversationId }, { _id: conversationId }],
      }).sort({ createdAt: -1 });

      if (!last) {
        return new Response(JSON.stringify({ ok: false, error: "THREAD_NOT_FOUND" }), { status: 404 });
      }

      subject = last.subject || "";
      ref = last.ref;

      // 推導對方：優先用上一封的發件人，否則用收件人
      const lastFrom = last.fromId ? String(last.fromId) : "";
      const lastTo = String(last.toId);
      const otherStr = lastFrom && lastFrom !== meId ? lastFrom : lastTo !== meId ? lastTo : lastFrom;

      if (!otherStr) {
        if (!SUPPORT_USER_ID) {
          return new Response(JSON.stringify({ ok: false, error: "NO_TARGET" }), { status: 400 });
        }
        const sup = await User.findById(SUPPORT_USER_ID).select({ _id: 1 });
        if (!sup) return new Response(JSON.stringify({ ok: false, error: "INVALID_SUPPORT_USER" }), { status: 400 });
        toId = sup._id;
      } else {
        toId = new mongoose.Types.ObjectId(otherStr);
      }

      // 會話鍵：若 last 沒有 conversationId，就用 pairCid 並回填整串
      if (!last.conversationId) {
        convId = pairCid(meId, String(toId));
        await Message.updateMany(
          { $or: [{ _id: last._id }, { conversationId: String(last._id) }] },
          { $set: { conversationId: convId } }
        );
      } else {
        convId = last.conversationId;
      }
    }

    // 寫入回覆（一定落在 convId 這一串）
    const msg = await Message.create({
      conversationId: convId,
      fromId: me._id,
      toId,
      subject,
      body: body.trim(),
      kind: "user",
      ref,
    });

    return Response.json(
      { ok: true, message: msg },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || "SERVER_ERROR" }), {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}

// /app/api/messages/send/route.js
import Message from "@/models/Message";
import User from "@/models/User";
import { requireAdmin } from "@/utils/auth";
import mongoose from "mongoose";

function pairCid(a, b) {
  const [x, y] = [String(a), String(b)].sort(); // 固定順序
  return `pair:${x}:${y}`;
}

export const dynamic = "force-dynamic";

function statusFromAuthError(message) {
  if (message === "UNAUTH") return 401;
  if (message === "FORBIDDEN") return 403;
  return 500;
}

// 小工具：判斷是否為合法 ObjectId
function asObjectIdMaybe(v) {
  if (!v || typeof v !== "string") return null;
  if (/^[0-9a-fA-F]{24}$/.test(v)) return new mongoose.Types.ObjectId(v);
  return null;
}

async function resolveRecipient({ to, toId }) {
  // 1) 明確 _id
  const directId = asObjectIdMaybe(toId || to);
  if (directId) {
    const u = await User.findById(directId).select({ _id: 1 });
    if (u) return u._id;
  }
  // 2) Email
  if (to && to.includes("@")) {
    const u = await User.findOne({ email: to.trim().toLowerCase() }).select({ _id: 1 });
    if (u) return u._id;
  }
  // 3) Username（忽略大小寫）
  if (to) {
    const u = await User.findOne({
      username: { $regex: `^${to.trim()}$`, $options: "i" }
    }).select({ _id: 1 });
    if (u) return u._id;
  }
  return null;
}

export async function POST(req) {
  try {
    const admin = await requireAdmin(req);
    const { to, toId, subject, body, kind = "admin", ref, conversationId } = await req.json();

    if (!subject || !body) {
      return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS" }), { status: 400 });
    }

    const resolvedToId = await resolveRecipient({ to, toId });
    if (!resolvedToId) {
      return new Response(JSON.stringify({ ok: false, error: "RECIPIENT_NOT_FOUND" }), { status: 404 });
    }

    const cid = conversationId || pairCid(admin._id, resolvedToId);
    const msg = await Message.create({
      conversationId: cid,
      fromId: admin._id,
      toId: resolvedToId,
      subject: subject.trim(),
      body: body.trim(),
      kind,
      ref,
    });

    return Response.json({ ok: true, message: msg }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message || "SERVER_ERROR" }),
      { status: statusFromAuthError(e?.message) }
    );
  }
}

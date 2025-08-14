import { modWarn } from "@/services/ModerationAction";
import { requireAdmin } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const action = await modWarn({
      operatorId: admin._id,
      targetUserId: body.targetUserId,
      reasonCode: body.reasonCode,
      reasonText: body.reasonText,
      level: Number(body.level || 1),
    });
    return Response.json({ ok: true, action }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
  }
}

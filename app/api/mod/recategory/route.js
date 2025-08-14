import { modRecategory } from "@/services/moderationService";
import { requireAdmin } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const admin = await requireAdmin(req); // 取 operatorId
    const body = await req.json();
    const action = await modRecategory({
      operatorId: admin._id,
      imageId: body.imageId,
      targetUserId: body.targetUserId,
      oldRating: body.oldRating,
      newRating: body.newRating,
      reasonCode: body.reasonCode,
      reasonText: body.reasonText
    });
    return Response.json({ ok: true, action }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 400 });
  }
}

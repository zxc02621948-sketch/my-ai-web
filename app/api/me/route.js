import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const me = await requireUser(req);
    return Response.json({
      ok: true,
      id: String(me._id),
      isAdmin: !!me.isAdmin,
      username: me.username || "",
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:"UNAUTH" }), { status: 401 });
  }
}

import Message from "@/models/Message";
import { requireUser } from "@/utils/auth";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const me = await requireUser(req);
  const { conversationId } = await req.json();
  if (!conversationId) return new Response(JSON.stringify({ ok:false, error:"MISSING_ID" }), { status:400 });

  await Message.updateMany(
    { conversationId },
    { $addToSet: { deletedFor: me._id } } // 對我隱藏
  );
  return Response.json({ ok:true });
}

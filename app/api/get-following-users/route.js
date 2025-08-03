// app/api/get-following-users/route.js
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  await dbConnect();
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json([]);
    }

    const users = await User.find({ _id: { $in: ids } }).select(
      "_id username avatar"
    );

    return Response.json(users);
  } catch (error) {
    console.error("取得追蹤清單失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}

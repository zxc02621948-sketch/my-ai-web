// app/api/edit-user/route.js
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import bcrypt from "bcrypt";

export async function POST(req) {
  await dbConnect();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: "未登入" }), { status: 401 });
    }

    const body = await req.json();
    const { username, bio, email, backupEmail } = body;

    const user = await User.findById(currentUser._id);
    if (!user) {
      return new Response(JSON.stringify({ error: "找不到使用者" }), { status: 404 });
    }

    // 安全驗證：最多 60 字簡介
    const safeBio = typeof bio === "string" ? bio.slice(0, 200) : "";

    // 寫入欄位（email 可之後搭配驗證流程）
    user.username = username || user.username;
    user.bio = safeBio;
    user.email = email || user.email;
    user.backupEmail = backupEmail || "";

    await user.save();

    return new Response(JSON.stringify(user), { status: 200 });
  } catch (err) {
    console.error("編輯使用者資料失敗：", err);
    return new Response(JSON.stringify({ error: "伺服器錯誤" }), { status: 500 });
  }
}

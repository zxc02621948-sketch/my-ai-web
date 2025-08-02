// app/api/edit-user/route.js
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";

export async function POST(req) {
  await dbConnect();

  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return new Response(JSON.stringify({ error: "未登入" }), { status: 401 });
    }

    const body = await req.json();
    const { username, bio, backupEmail } = body;

    const user = await User.findById(currentUser._id);
    if (!user) {
      return new Response(JSON.stringify({ error: "找不到使用者" }), { status: 404 });
    }

    // 限制 bio 字數
    const safeBio = typeof bio === "string" ? bio.slice(0, 80) : "";

    // ✅ 備用信箱處理
    if (backupEmail !== undefined) {
      // 不可與主信箱相同
      if (backupEmail === user.email) {
        return new Response(JSON.stringify({ error: "備用信箱不能與主信箱相同" }), { status: 400 });
      }

      // 不可為他人註冊過的主信箱
      const existingUser = await User.findOne({ email: backupEmail });
      if (existingUser && existingUser._id.toString() !== currentUser._id.toString()) {
        return new Response(JSON.stringify({ error: "這個信箱已被其他帳號註冊，無法作為備用信箱" }), {
          status: 400,
        });
      }

      // 若備用信箱不同才更新
      if (user.backupEmail !== backupEmail) {
        user.backupEmail = backupEmail;
        user.isBackupEmailVerified = false;
      }
    }

    // 其他欄位
    user.username = username || user.username;
    user.bio = safeBio;

    await user.save();

    return new Response(JSON.stringify(user), { status: 200 });
  } catch (err) {
    console.error("編輯使用者資料失敗：", err);
    return new Response(
     JSON.stringify({ error: "伺服器錯誤", message: err.message }),
      { status: 500 }
    );
  }
}

import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();
    const token = new URL(req.url).searchParams.get("token");
    console.log("📥 收到驗證請求 token：", token);

    if (!token) {
      return new Response(JSON.stringify({ error: "缺少驗證 token" }), { status: 400 });
    }

    const user = await User.findOne({ verificationToken: token });
    console.log("🔍 查詢結果 user：", user);

    if (!user) {
      return new Response(JSON.stringify({ error: "無效或過期的驗證連結" }), { status: 404 });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return new Response(JSON.stringify({ message: "驗證成功" }), { status: 200 });
  } catch (error) {
    console.error("❌ 驗證失敗：", error); // ⬅️ 就是要這行！
    return new Response(JSON.stringify({ error: "伺服器錯誤：" + error.message }), {
      status: 500,
    });
  }
}

import { connectToDatabase } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: "缺少 token 或新密碼" }), { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }, // 有效時間內
    });

    if (!user) {
      return new Response(JSON.stringify({ error: "無效或過期的重設連結" }), { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return new Response(JSON.stringify({ message: "密碼已更新" }), { status: 200 });
  } catch (err) {
    console.error("❌ 重設密碼錯誤：", err);
    return new Response(JSON.stringify({ error: "伺服器錯誤，請稍後再試。" }), { status: 500 });
  }
}

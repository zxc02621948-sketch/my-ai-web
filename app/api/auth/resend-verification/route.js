// app/api/auth/resend-verification/route.js

import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { sendVerificationEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    console.log("🐛 收到重寄驗證信請求");

    const { email } = await req.json();
    console.log("📨 email 接收到：", email);

    if (!email) {
      return new Response(JSON.stringify({ error: "缺少 email" }), { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email });

    if (!user) {
      return new Response(JSON.stringify({ error: "找不到使用者" }), { status: 404 });
    }

    if (user.isVerified) {
      return new Response(JSON.stringify({ message: "帳號已完成驗證" }), { status: 400 });
    }

    // ✅ 這裡先判斷是否太快連續寄送
    const now = Date.now();
    const lastSent = user.lastVerificationEmailSentAt?.getTime() || 0;
    if (now - lastSent < 60 * 1000) {
      return new Response(
        JSON.stringify({ message: "請稍候再試，1 分鐘內只能寄一次驗證信" }),
        { status: 429 }
      );
    }

    // ✅ 通過限制後才真正產生 token 並寄信
    const newToken = uuidv4();
    user.verificationToken = newToken;
    user.lastVerificationEmailSentAt = new Date();
    await user.save();

    await sendVerificationEmail({ email, token: newToken });

    return new Response(JSON.stringify({ message: "驗證信已重新寄出" }), { status: 200 });
  } catch (error) {
    console.error("❌ 重寄驗證信錯誤：", error);
    return new Response(
      JSON.stringify({ error: "寄送失敗：" + error.message }),
      { status: 500 }
    );
  }
}

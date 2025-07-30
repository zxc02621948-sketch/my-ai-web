import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { sendResetPasswordEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: '缺少 email' }), { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email });

    if (!user) {
      return new Response(JSON.stringify({ error: '查無此帳號' }), { status: 404 });
    }

    // 產生 token 並設定過期時間
    const token = uuidv4();
    const expires = Date.now() + 3600 * 1000; // 一小時有效

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;
    await sendResetPasswordEmail(email, resetUrl);

    return new Response(JSON.stringify({ message: '已寄出重設密碼信件' }), { status: 200 });
  } catch (error) {
    console.error('❌ 忘記密碼發生錯誤：', error);
    return new Response(JSON.stringify({ error: '伺服器錯誤' }), { status: 500 });
  }
}

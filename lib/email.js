// /lib/email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 驗證信用
export async function sendVerificationEmail({ email, token }) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/verify?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM, // 測試用寄件信箱
      to: email,
      subject: "請驗證您的帳號",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>歡迎加入我的 AI 圖片平台 🎉</h2>
          <p>請點擊下方按鈕完成帳號驗證：</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
            驗證我的帳號
          </a>
          <p style="margin-top: 16px; color: #666;">或直接點擊以下連結：<br/>${verifyUrl}</p>
        </div>
      `,
    });


    if (!result || result.error) {
      throw new Error("寄送驗證信失敗：" + (result?.error?.message || "未知錯誤"));
    }

    return result.data;
  } catch (error) {
    console.error("📨 發送驗證信錯誤：", error);
    throw new Error("寄送驗證信失敗：" + error.message);
  }
}

// 忘記密碼信用
export async function sendResetPasswordEmail(email, resetUrl) {
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM, // 測試用寄件信箱
      to: email,
      subject: "重設您的密碼",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>重設密碼請求 🔐</h2>
          <p>我們收到您重設密碼的請求，請點擊以下按鈕重設您的密碼：</p>
          <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
            重設我的密碼
          </a>
          <p style="margin-top: 16px; color: #666;">或直接點擊以下連結：<br/>${resetUrl}</p>
          <hr />
          <p style="font-size: 12px; color: #999;">如果您沒有提出這項請求，可以忽略此封郵件。</p>
        </div>
      `,
    });

    if (!result || result.error) {
      throw new Error("寄送重設密碼信失敗：" + (result?.error?.message || "未知錯誤"));
    }

    return result.data;
  } catch (error) {
    console.error("📨 發送重設密碼信錯誤：", error);
    throw new Error("寄送重設密碼信失敗：" + error.message);
  }
}

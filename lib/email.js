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

// ✅ 發送帳號註銷驗證碼
export async function sendAccountDeletionCode({ email, code, deletionScheduledAt }) {
  const formattedDate = new Date(deletionScheduledAt).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const cancelUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/settings/account/deletion?cancel=true`;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: "帳號註銷驗證碼",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ 帳號註銷驗證碼</h2>
          <p>您已申請註銷帳號，請使用以下驗證碼完成註銷流程：</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; letter-spacing: 8px; color: #1f2937; margin: 0;">${code}</h1>
          </div>
          <p style="color: #dc2626; font-weight: bold;">⚠️ 重要提醒：</p>
          <ul style="color: #374151;">
            <li>此驗證碼將在 10 分鐘後過期</li>
            <li>驗證成功後，您的帳號將在 <strong>${formattedDate}</strong> 被永久刪除</li>
            <li>在刪除前，您可以隨時取消註銷請求</li>
          </ul>
          <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px;">
            <p style="margin: 0; color: #92400e;">
              <strong>如果您沒有申請註銷帳號，請立即：</strong><br/>
              <a href="${cancelUrl}" style="color: #dc2626; text-decoration: underline;">點擊此處取消註銷請求</a>
            </p>
          </div>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #9ca3af;">
            此郵件由系統自動發送，請勿回覆。
          </p>
        </div>
      `,
    });

    if (!result || result.error) {
      throw new Error("寄送註銷驗證碼失敗：" + (result?.error?.message || "未知錯誤"));
    }

    return result.data;
  } catch (error) {
    console.error("📨 發送註銷驗證碼錯誤：", error);
    throw new Error("寄送註銷驗證碼失敗：" + error.message);
  }
}

// ✅ 發送帳號註銷取消確認信
export async function sendAccountDeletionCancelledEmail({ email }) {
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: email,
      subject: "帳號註銷已取消",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">✅ 帳號註銷已取消</h2>
          <p>您的帳號註銷請求已成功取消，帳號將繼續保留。</p>
          <p style="color: #374151;">如果您有任何問題或需要協助，請隨時聯繫我們。</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #9ca3af;">
            此郵件由系統自動發送，請勿回覆。
          </p>
        </div>
      `,
    });

    if (!result || result.error) {
      throw new Error("寄送取消確認信失敗：" + (result?.error?.message || "未知錯誤"));
    }

    return result.data;
  } catch (error) {
    console.error("📨 發送取消確認信錯誤：", error);
    throw new Error("寄送取消確認信失敗：" + error.message);
  }
}
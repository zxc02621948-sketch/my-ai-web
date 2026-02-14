// app/api/account/deletion/send-code/route.js
// 步驟 1: 要求輸入原密碼並發送驗證碼

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { sendAccountDeletionCode } from "@/lib/email";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

// 生成 6 位數驗證碼
function generateDeletionCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { success: false, message: "請輸入密碼" },
        { status: 400 }
      );
    }

    const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
    if (!currentUser?._id) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到用戶" },
        { status: 404 }
      );
    }

    // ✅ 步驟 1: 驗證原密碼
    if (!user.password) {
      return NextResponse.json(
        { success: false, message: "此帳號使用第三方登入，無法註銷" },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "密碼錯誤" },
        { status: 401 }
      );
    }

    // 檢查是否已經有未過期的驗證碼
    const now = new Date();
    if (
      user.deletionCode &&
      user.deletionCodeExpiresAt &&
      user.deletionCodeExpiresAt > now
    ) {
      // 檢查是否在 1 分鐘內發送過
      const lastSent = user.lastDeletionCodeSentAt?.getTime() || 0;
      if (now.getTime() - lastSent < 60 * 1000) {
        return NextResponse.json(
          { success: false, message: "請稍候再試，1 分鐘內只能發送一次驗證碼" },
          { status: 429 }
        );
      }
    }

    // ✅ 步驟 2: 生成 6 位數驗證碼
    const code = generateDeletionCode();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 分鐘後過期
    const deletionScheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 天後刪除

    // 保存驗證碼和刪除時間
    user.deletionCode = code;
    user.deletionCodeExpiresAt = expiresAt;
    user.deletionRequestedAt = now;
    user.deletionScheduledAt = deletionScheduledAt;
    user.lastDeletionCodeSentAt = now;
    await user.save();

    // ✅ 發送驗證碼郵件
    try {
      await sendAccountDeletionCode({
        email: user.email,
        code,
        deletionScheduledAt,
      });
    } catch (emailError) {
      console.error("發送驗證碼郵件失敗：", emailError);
      // 即使郵件發送失敗，也返回成功（避免洩露用戶是否存在）
      return NextResponse.json(
        { success: true, message: "驗證碼已發送到您的郵箱" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "驗證碼已發送到您的郵箱",
        deletionScheduledAt: deletionScheduledAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("發送註銷驗證碼錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}


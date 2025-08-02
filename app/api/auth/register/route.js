import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req) {
  try {
    const {
      email,
      backupEmail = "",
      password,
      username,
      birthday,
      gender = "hidden",
      image, // ✅ 改為 image
    } = await req.json();

    if (!email || !password || !username || !birthday) {
      return NextResponse.json({ success: false, message: "缺少必要欄位" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: "Email 格式不正確" }, { status: 400 });
    }

    if (backupEmail && !emailRegex.test(backupEmail)) {
      return NextResponse.json({ success: false, message: "備用 Email 格式不正確" }, { status: 400 });
    }

    // ✅ 檢查是否已滿 18 歲
    const birthDate = new Date(birthday);
    const today = new Date();
    const age =
      today.getFullYear() - birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);

    if (age < 18) {
      return NextResponse.json({ success: false, message: "未滿 18 歲無法註冊" }, { status: 403 });
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ success: false, message: "此 Email 已被註冊" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = uuidv4();

    await User.create({
      email,
      backupEmail,
      password: hashedPassword,
      username,
      birthday,
      gender,
      image, // ✅ 儲存到 image 欄位
      isVerified: false,
      verificationToken: verifyToken,
    });

    await sendVerificationEmail({ email, token: verifyToken });

    return NextResponse.json({ success: true, message: "註冊成功，請至信箱完成驗證" });
  } catch (error) {
    console.error("❌ 註冊失敗：", error);

    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern || {})[0];
      const msg =
        duplicatedField === "email"
          ? "此 Email 已被註冊"
          : duplicatedField === "username"
          ? "使用者名稱已存在"
          : "資料重複";

      return NextResponse.json({ success: false, message: msg }, { status: 409 });
    }

    return NextResponse.json({ success: false, message: "伺服器錯誤" }, { status: 500 });
  }
}

import { dbConnect } from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/serverAuth";
import User from "@/models/User";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const POST = withErrorHandling(async (req) => {
  const { email, password } = await req.json();
  console.log("📥 收到帳密：", { email, password });

  if (!email || !password) {
    return apiError("請輸入帳號與密碼", 400);
  }

  await dbConnect();
  const user = await User.findOne({ email }).lean();
  console.log("🪪 使用者完整資料：", user);

  if (!user) {
    return apiError("帳號不存在", 401);
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return apiError("密碼錯誤", 401);
  }

  // ✅ 不再寄驗證信！只提示未驗證狀態
  if (!user.isVerified) {
    return apiError("尚未驗證", 403, { reason: "unverified" });
  }

  const payload = {
    id: user._id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin || false,
  };

  console.log("🎯 token payload：", payload);

  const token = generateToken(payload);

  const responseData = {
    token,
    user: {
      _id: user._id,
      username: user.username,
      isAdmin: user.isAdmin || false,
    },
    message: "登入成功"
  };

  // 設置 cookie
  const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  const response = apiSuccess(responseData);
  response.cookies.set("token", token, cookieOptions);
  return response;
});

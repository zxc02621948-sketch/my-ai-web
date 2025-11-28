import { dbConnect } from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const POST = withErrorHandling(async (req) => {
  const { email, password } = await req.json();

  if (!email || !password) {
    return apiError("請輸入帳號與密碼", 400);
  }

  await dbConnect();
  const user = await User.findOne({ email }).lean();

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

  const token = generateToken(payload);

  // ✅ 檢查是否有註冊獎勵（檢查是否有 register_bonus 類型的積分交易）
  let hasRegisterBonus = false;
  try {
    const registerBonus = await PointsTransaction.findOne({
      userId: user._id,
      type: "register_bonus",
    }).lean();
    
    if (registerBonus) {
      // 檢查是否在24小時內註冊（獎勵是在註冊時發放的）
      const bonusTime = new Date(registerBonus.createdAt);
      const now = new Date();
      const hoursDiff = (now - bonusTime) / (1000 * 60 * 60);
      
      // 如果獎勵是在24小時內發放的，檢查用戶是否已經看過彈窗
      if (hoursDiff <= 24) {
        // ✅ 檢查 meta 中是否有已顯示的標記
        const hasShown = registerBonus.meta?.bonusShown === true;
        
        if (!hasShown) {
          // 標記為已顯示，避免重複顯示
          await PointsTransaction.updateOne(
            { _id: registerBonus._id },
            { $set: { "meta.bonusShown": true } }
          );
          hasRegisterBonus = true;
        }
        // 如果已經顯示過，hasRegisterBonus 保持為 false
      }
    }
  } catch (error) {
    console.error("檢查註冊獎勵時發生錯誤：", error);
    // 錯誤不影響登入流程
  }

  const responseData = {
    token,
    user: {
      _id: user._id,
      username: user.username,
      isAdmin: user.isAdmin || false,
    },
    message: "登入成功",
    hasRegisterBonus, // ✅ 返回是否有註冊獎勵
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

import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const PATCH = withErrorHandling(async (req) => {
  await dbConnect();
  
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return apiError("未登入", 401);
  }

  const { preferences } = await req.json();
  
  if (!preferences || typeof preferences !== 'object') {
    return apiError("無效的偏好設定", 400);
  }

  // 更新用戶的隱私偏好
  const updatedUser = await User.findByIdAndUpdate(
    currentUser._id,
    {
      $set: {
        "privacyPreferences.allowMarketingEmails": preferences.allowMarketingEmails !== false,
        "privacyPreferences.allowDataAnalytics": preferences.allowDataAnalytics !== false,
        "privacyPreferences.allowPersonalization": preferences.allowPersonalization !== false,
        "privacyPreferences.allowProfileIndexing": preferences.allowProfileIndexing !== false,
      }
    },
    { new: true }
  ).select("privacyPreferences").lean();

  return apiSuccess({
    message: "隱私設定已更新",
    preferences: updatedUser.privacyPreferences
  });
});

// GET - 獲取當前隱私偏好
export const GET = withErrorHandling(async (req) => {
  await dbConnect();
  
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return apiError("未登入", 401);
  }

  const user = await User.findById(currentUser._id)
    .select("privacyPreferences")
    .lean();

  return apiSuccess({
    preferences: user?.privacyPreferences || {
      allowMarketingEmails: true,
      allowDataAnalytics: true,
      allowPersonalization: true,
      allowProfileIndexing: true,
    }
  });
});


import Warning from "@/models/Warning";
import User from "@/models/User";

export async function getActiveWarningCount(userId, now = new Date()) {
  return Warning.countDocuments({
    userId,
    isRevoked: false,
    expiresAt: { $gt: now },
  });
}

// 達 3 支（皆在有效期內）→ 立刻永久鎖（之後不會自動解）
export async function applyPermanentLockIfNeeded(userId) {
  const cnt = await getActiveWarningCount(userId);
  if (cnt >= 3) {
    await User.findByIdAndUpdate(
      userId,
      { isSuspended: true, isPermanentSuspension: true, suspendedAt: new Date() },
      { new: true }
    ).lean();
    return { activeWarnings: cnt, isSuspended: true, isPermanentSuspension: true };
  }
  return { activeWarnings: cnt, isSuspended: false, isPermanentSuspension: false };
}

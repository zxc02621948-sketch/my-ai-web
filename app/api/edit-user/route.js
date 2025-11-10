// app/api/edit-user/route.js
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import Music from "@/models/Music";
import Video from "@/models/Video";
import DiscussionPost from "@/models/DiscussionPost";
import DiscussionComment from "@/models/DiscussionComment";
import { requireAuth } from "@/lib/authUtils";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const PUT = requireAuth(
  withErrorHandling(async (req, context) => {
    const { user } = context;
    const { username, bio, backupEmail, defaultMusicUrl } = await req.json();
    
    await dbConnect();
    
    // 檢查用戶是否存在
    const userRecord = await User.findById(user._id);
    if (!userRecord) {
      return apiError("找不到使用者", 404);
    }
    const originalUsername = userRecord.username;
    
    // 限制 bio 字數
    const safeBio = typeof bio === "string" ? bio.slice(0, 60) : "";
    
    // ✅ 備用信箱處理
    if (backupEmail !== undefined) {
      // 不可與主信箱相同
      if (backupEmail === userRecord.email) {
        return apiError("備用信箱不能與主信箱相同", 400);
      }
      
      // 不可為他人註冊過的主信箱
      const existingUser = await User.findOne({ email: backupEmail });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return apiError("這個信箱已被其他帳號註冊，無法作為備用信箱", 400);
      }
      
      // 若備用信箱不同才更新
      if (userRecord.backupEmail !== backupEmail) {
        userRecord.backupEmail = backupEmail;
        userRecord.isBackupEmailVerified = false;
      }
    }

    // ✅ 音樂連結（僅允許 YouTube / youtu.be，且必須為 https）
    if (defaultMusicUrl !== undefined) {
      const val = String(defaultMusicUrl || "").trim();
      if (val === "") {
        userRecord.defaultMusicUrl = ""; // 清空設定
      } else {
        try {
          const u = new URL(val);
          const host = u.hostname.toLowerCase();
          const allowedHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]; 
          const isHttps = u.protocol === "https:";
          if (!isHttps || !allowedHosts.includes(host)) {
            return apiError("音樂連結僅接受 https 的 YouTube 或 youtu.be 連結", 400);
          }
          userRecord.defaultMusicUrl = val;
        } catch {
          return apiError("音樂連結格式不正確", 400);
        }
      }
    }
    
    // 其他欄位
    if (typeof username === "string") {
      const trimmed = username.trim();
      if (trimmed) {
        userRecord.username = trimmed;
      }
    }
    userRecord.bio = safeBio;
    
    await userRecord.save();
    
    if (userRecord.username !== originalUsername) {
      const newUsername = userRecord.username;
      const userId = userRecord._id;
      try {
        await Promise.all([
          Image.updateMany(
            { $or: [{ userId: userId.toString() }, { username: originalUsername }] },
            { $set: { username: newUsername } }
          ),
          Music.updateMany(
            { $or: [{ author: userId }, { authorName: originalUsername }] },
            { $set: { authorName: newUsername } }
          ),
          Video.updateMany(
            { $or: [{ author: userId }, { authorName: originalUsername }] },
            { $set: { authorName: newUsername } }
          ),
          DiscussionPost.updateMany(
            { $or: [{ author: userId }, { authorName: originalUsername }] },
            { $set: { authorName: newUsername } }
          ),
          DiscussionComment.updateMany(
            { $or: [{ author: userId }, { authorName: originalUsername }] },
            { $set: { authorName: newUsername } }
          ),
          DiscussionComment.updateMany(
            { replyToName: originalUsername },
            { $set: { replyToName: newUsername } }
          ),
          User.updateMany(
            { "pinnedPlayer.userId": userId },
            { $set: { "pinnedPlayer.username": newUsername } }
          ),
        ]);
      } catch (syncError) {
        console.error("[edit-user] Failed to sync username to related documents:", syncError);
      }
    }
    
    return apiSuccess(userRecord);
  })
);

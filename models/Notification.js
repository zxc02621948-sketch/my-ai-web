// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { 
      type: String, 
      enum: ["comment", "reply", "new_image", "subscription_renewed", "subscription_cancelled", "subscription_expired", "subscription_expiring", "discussion_mention", "discussion_reply"], 
      required: true 
    },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
    text: { type: String }, // 用戶通知的詳細內容
    message: { type: String }, // 系統通知的主要內容
    link: { type: String }, // 系統通知的跳轉鏈接
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 強制使用新的 schema（開發環境）
if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
export { Notification };

// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 接收者
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 發出者
    type: { type: String, enum: ["comment", "reply"], required: true }, // 通知類型
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" }, // 相關圖片
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" }, // 相關留言
    text: { type: String }, // 摘要內容（留言文字）
    isRead: { type: Boolean, default: false }, // 是否已讀
  },
  { timestamps: true } // createdAt, updatedAt
);

export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

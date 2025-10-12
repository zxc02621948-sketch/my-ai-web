// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["comment", "reply", "new_image"], required: true }, // ✅ 加上 new_image
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
    text: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
export { Notification };

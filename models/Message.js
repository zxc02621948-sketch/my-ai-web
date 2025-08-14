import mongoose, { Schema } from "mongoose";

const MessageSchema = new Schema({
  conversationId: { type: String, index: true },   // 會話分組鍵（第一封=它自己的 _id 字串）
  fromId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null }, // null = 系統
  toId:   { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
  subject:{ type: String, required: true },
  body:   { type: String, required: true },
  kind:   { type: String, enum: ["system","admin","user"], default: "system", index: true },
  ref:    {
    type: { type: String, enum: ["image","action","other"], default: "other" },
    id: { type: Schema.Types.ObjectId },
    extra: { type: Schema.Types.Mixed }
  },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);

import mongoose, { Schema } from "mongoose";

const ModerationActionSchema = new Schema({
  operatorId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
  imageId: { type: Schema.Types.ObjectId, ref: "Image" },

  action: { type: String, enum: ["TAKEDOWN","RECAT","WARN_L1","WARN_L2","WARN_L3"], required: true },
  reasonCode: { type: String },     // 例如: "NSFW_IN_SFW", "COPYRIGHT", ...
  reasonText: { type: String },     // 你自由輸入的補充

  oldRating: { type: Number },      // 舊分級/分類
  newRating: { type: Number },

  templateKey: { type: String },    // 用了哪個版模（可選）
  snapshot: { type: Schema.Types.Mixed }, // 當下快照（避免之後資料變動）
}, { timestamps: true });

export default mongoose.models.ModerationAction || mongoose.model("ModerationAction", ModerationActionSchema);

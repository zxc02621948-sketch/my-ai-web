import mongoose from "mongoose";

const PointsTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { 
      type: String, 
      enum: ["upload", "like_received", "comment_received", "daily_login", "like_given", "admin_gift"], 
      required: true 
    },
    points: { type: Number, required: true },
    // 來源實體：圖片/留言（去重、審計用）
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // 觸發事件的行為者（例如按讚者/留言者/上傳者）
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // 以天為單位的鍵（UTC YYYY-MM-DD）（每日上限/查詢用）
    dateKey: { type: String, required: true },
    meta: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "points_transactions" }
);

// 常用查詢索引
PointsTransactionSchema.index({ userId: 1, type: 1, dateKey: 1 });
PointsTransactionSchema.index({ userId: 1, type: 1, actorUserId: 1, sourceId: 1, dateKey: 1 });
// 針對終身去重查詢最佳化（不含 dateKey）
PointsTransactionSchema.index({ userId: 1, type: 1, actorUserId: 1, sourceId: 1 });

export default mongoose.models.PointsTransaction || mongoose.model("PointsTransaction", PointsTransactionSchema);
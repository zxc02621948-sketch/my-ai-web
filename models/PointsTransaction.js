import mongoose from "mongoose";

const PointsTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { 
      type: String, 
      enum: [
        "upload", "video_upload", "music_upload", // 上傳類型：圖片+5，影片+10，音樂+10
        "like_received", "comment_received", "daily_login", "like_given", 
        "admin_gift", "store_purchase", "subscription_purchase", "frame_color_edit",
        "discussion_post_cost",      // 發多圖教學帖消耗積分
        "discussion_like_reward",    // 多圖教學帖收到愛心獎勵
        "discussion_claim_reward",   // 提領討論區獎勵積分
        "playlist_expansion"         // 播放清單擴充
      ], 
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

// 強制使用新的 schema（開發環境）
if (mongoose.models.PointsTransaction) {
  delete mongoose.models.PointsTransaction;
}

export default mongoose.model("PointsTransaction", PointsTransactionSchema);
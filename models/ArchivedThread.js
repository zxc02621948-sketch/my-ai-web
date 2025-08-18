// /models/ArchivedThread.js
import mongoose from "mongoose";

const ArchivedThreadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    cid: { type: String, index: true, required: true }, // 例如 pair:<a>:<b> 或任一你採用的 cid
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "archived_threads" }
);

// 每個使用者同一個 cid 只會有一筆
ArchivedThreadSchema.index({ userId: 1, cid: 1 }, { unique: true });

export default mongoose.models.ArchivedThread || mongoose.model("ArchivedThread", ArchivedThreadSchema);

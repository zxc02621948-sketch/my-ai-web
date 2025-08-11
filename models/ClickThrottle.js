import mongoose from "mongoose";

const ClickThrottleSchema = new mongoose.Schema(
  {
    imageId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    key:     { type: String, required: true, index: true }, // userId 或 cid
    createdAt: { type: Date, default: Date.now, expires: 30 }, // 30 秒 TTL
  },
  { collection: "click_throttle" }
);

// 同一張圖 + 同一 key 在冷卻期內只能存在一筆
ClickThrottleSchema.index({ imageId: 1, key: 1 }, { unique: true });

export default mongoose.models.ClickThrottle || mongoose.model("ClickThrottle", ClickThrottleSchema);

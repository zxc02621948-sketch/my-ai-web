// /models/Report.js
import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    // 圖片檢舉字段（可選）
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image", index: true },
    // 討論區檢舉字段（可選）
    targetId: { type: mongoose.Schema.Types.ObjectId, index: true },
    
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        // 圖片檢舉類型
        "category_wrong","rating_wrong","duplicate","broken","policy_violation","other",
        // 討論區檢舉類型
        "discussion_post","discussion_comment"
      ],
      required: true
    },
    message: { type: String, default: "" },
    details: { type: String, default: "" }, // 額外詳情
    status: {
      type: String,
      enum: ["open","action_taken","rejected","closed"],
      default: "open",
      index: true
    }
  },
  { timestamps: true }
);

// 查詢輔助索引
ReportSchema.index({ reporterId: 1, createdAt: -1 });
ReportSchema.index({ imageId: 1, type: 1, createdAt: -1 });
ReportSchema.index({ targetId: 1, type: 1, createdAt: -1 }); // 討論區檢舉索引

// 強制重新定義模型以清除緩存
if (mongoose.models.Report) {
  delete mongoose.models.Report;
}

export default mongoose.model("Report", ReportSchema);

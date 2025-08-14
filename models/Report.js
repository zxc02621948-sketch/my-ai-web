// /models/Report.js
import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image", required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["category_wrong","rating_wrong","duplicate","broken","policy_violation","other"],
      required: true
    },
    message: { type: String, default: "" },
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

export default mongoose.models.Report || mongoose.model("Report", ReportSchema);

import mongoose from "mongoose";

const WarningSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reasonCode: {
      type: String,
      enum: ["policy_violation","category_wrong","rating_wrong","duplicate_content"],
      required: true
    },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    note: { type: String, default: "" },
    expiresAt: { type: Date, required: true },    // now + N 天（預設 60）
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

WarningSchema.index({ userId: 1, expiresAt: 1, isRevoked: 1 });

export default mongoose.models.Warning || mongoose.model("Warning", WarningSchema);

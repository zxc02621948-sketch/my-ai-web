import mongoose from "mongoose";

const LikeLogSchema = new mongoose.Schema({
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.LikeLog || mongoose.model("LikeLog", LikeLogSchema);

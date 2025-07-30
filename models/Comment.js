// /models/Comment.js

import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  imageId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    default: "匿名用戶",
  },
    userName: {
    type: String,
    default: "匿名用戶", // ✅ 可以預設一下
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Comment || mongoose.model("Comment", CommentSchema);

// models/Feedback.js
import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["bug", "suggestion", "ux", "other"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    pageUrl: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isHandled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Feedback =
  mongoose.models.Feedback || mongoose.model("Feedback", FeedbackSchema);

// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    lastVerificationEmailSentAt: { type: Date, default: null },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    isVerified: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    image: { type: String, default: '' },
    avatar: { type: String, default: '' }, // ✅ 新增

    gender: {
      type: String,
      enum: ['male', 'female', 'hidden'],
      default: 'hidden',
    },

    bio: { type: String, default: '' },           // ✅ 新增
    backupEmail: { type: String, default: '' },   // ✅ 新增
    isBackupEmailVerified: { type: Boolean, default: false },

    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

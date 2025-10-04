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

    // ✅ 加入追蹤欄位
    following: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" }
      },
    ],

    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
    ,
    // 封鎖與永久鎖（Strike 3 within window）
    isSuspended: { type: Boolean, default: false },
    isPermanentSuspension: { type: Boolean, default: false },
    suspendedAt: { type: Date, default: null }
    ,
    // ✅ 積分餘額（Phase A）
    pointsBalance: { type: Number, default: 0 },

    // ✅ 使用者預設音樂來源（播放頁讀取）
    defaultMusicUrl: { type: String, default: '' },

    // ✅ 迷你播放器購買狀態與樣式（僅個人頁顯示）
    miniPlayerPurchased: { type: Boolean, default: false },
    miniPlayerTheme: { type: String, default: 'modern' },

    // ✅ 頭像框系統
    currentFrame: { type: String, default: 'default' },
    ownedFrames: [{ type: String, default: ['default'] }]
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

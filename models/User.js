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
    
    // ✅ 總獲得積分（用於等級計算，只增不減）
    totalEarnedPoints: { type: Number, default: 0 },
    
    // ✅ 討論區待領取積分（所有多圖教學帖的總和）
    discussionPendingPoints: { type: Number, default: 0 },
    
    // ✅ 討論區收藏的帖子（存儲帖子 ID）
    bookmarkedDiscussionPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "DiscussionPost" }],

    // ✅ 使用者預設音樂來源（播放頁讀取）
    defaultMusicUrl: { type: String, default: '' },
    
    // ✅ 播放清單（存儲用戶的完整播放清單）
    playlist: { 
      type: [{ 
        title: String, 
        url: String 
      }], 
      default: [] 
    },
    
    // ✅ 播放清單上限（可通過購買擴充）
    playlistMaxSize: { type: Number, default: 5 },

    // ✅ 迷你播放器購買狀態與樣式（僅個人頁顯示）
    miniPlayerPurchased: { type: Boolean, default: false },
    miniPlayerTheme: { type: String, default: 'modern' },
    miniPlayerExpiry: { type: Date, default: null }, // 播放器過期時間（體驗券）
    playerCouponUsed: { type: Boolean, default: false }, // 1日免費體驗券是否已使用
    
    // ✅ 高階播放器造型系統（付費功能）
    premiumPlayerSkin: { type: Boolean, default: false }, // 是否購買高階造型
    premiumPlayerSkinExpiry: { type: Date, default: null }, // 造型過期時間（如果是訂閱制）
    activePlayerSkin: { type: String, default: 'default' }, // 當前啟用的造型 ('default' | 'cat-headphone')
    playerSkinSettings: { 
      type: {
        mode: { type: String, default: 'rgb' }, // 'rgb' | 'solid' | 'custom'
        speed: { type: Number, default: 0.02 }, // 流動速度
        saturation: { type: Number, default: 50 }, // 飽和度
        lightness: { type: Number, default: 60 }, // 亮度
        hue: { type: Number, default: 0 }, // 色相
        opacity: { type: Number, default: 0.7 } // 透明度 (0-1)
      },
      default: {
        mode: 'rgb',
        speed: 0.02,
        saturation: 50,
        lightness: 60,
        hue: 0,
        opacity: 0.7
      }
    },

    // ✅ 頭像框系統
    currentFrame: { type: String, default: 'default' },
    ownedFrames: [{ type: String, default: ['default'] }],
    frameSettings: { type: Object, default: {} },
    
    // ✅ 功能解鎖狀態
    frameColorEditorUnlocked: { type: Boolean, default: false },
    
    // ✅ 曝光分數系統
    exposureMultiplier: { type: Number, default: 1.0 },
    exposureBonus: { type: Number, default: 0 },
    exposureExpiry: { type: Date, default: null },
    exposureType: { type: String, enum: ['temporary', 'permanent'], default: 'temporary' },
    
    // ✅ 權力券系統
    powerCoupons: { type: Number, default: 0 },
    
    // ✅ 隱私偏好設定（用於「反對權」等隱私權利）
    privacyPreferences: {
      allowMarketingEmails: { type: Boolean, default: true },      // 允許接收行銷郵件
      allowDataAnalytics: { type: Boolean, default: true },         // 允許數據分析
      allowPersonalization: { type: Boolean, default: true },       // 允許個人化推薦
      allowProfileIndexing: { type: Boolean, default: true },       // 允許搜尋引擎索引個人頁面
    },
    activePowerImages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Image" }],
    lastPowerUse: { type: Date, default: null },
    
    // ✅ 訂閱狀態
    isSubscribed: { type: Boolean, default: false },
    subscriptionExpiry: { type: Date, default: null },
    subscriptionType: { type: String, enum: ['monthly', 'yearly'], default: null },
    
    // ✅ 釘選播放器系統（使用 Mixed 類型避免嵌套對象問題）
    pinnedPlayer: {
      type: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: { type: String },
        playlist: [{ 
          title: { type: String },
          url: { type: String }
        }],
        pinnedAt: { type: Date },
        expiresAt: { type: Date },
        currentIndex: { type: Number, default: 0 },
        isPlaying: { type: Boolean, default: false }
      },
      default: undefined
    },
    pinnedPlayerSettings: {
      showReminder: { type: Boolean, default: true }
    },
    
    // ✅ 訂閱管理系統（月租功能 - 累積制）
    subscriptions: [{
      type: { type: String, enum: ['pinPlayer', 'pinPlayerTest', 'uploadQuota', 'premiumFeatures'] },
      startDate: { type: Date },
      expiresAt: { type: Date }, // 到期時間（累積制，續費時延長）
      isActive: { type: Boolean, default: true },
      monthlyCost: { type: Number },
      lastRenewedAt: { type: Date }, // 最後續費時間
      cancelledAt: { type: Date, default: null }
    }]
  },
  {
    timestamps: true
  }
);

// 強制使用新的 schema（開發環境）
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model("User", userSchema);

export default User;

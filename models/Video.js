import mongoose from 'mongoose';

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  videoUrl: {
    type: String,
    required: true,
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  duration: {
    type: Number,
    default: 0, // 秒數
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  authorName: {
    type: String,
    required: true,
  },
  authorAvatar: {
    type: String,
    default: '',
  },
  
  // ✅ 互動數據
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likesCount: {
    type: Number,
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
  clicks: {
    type: Number,
    default: 0,
  },
  
  // ✅ AI 生成元數據
  platform: {
    type: String,
    default: '', // e.g., 'Runway', 'Pika', 'Stable Video Diffusion'
  },
  prompt: {
    type: String,
    default: '',
  },
  negativePrompt: {
    type: String,
    default: '',
  },
  modelName: {
    type: String,
    default: '',
  },
  modelLink: {
    type: String,
    default: '',
  },
  
  // ✅ 生成參數
  fps: {
    type: Number,
    default: null,
  },
  resolution: {
    type: String,
    default: '', // e.g., '1920x1080', '1280x720'
  },
  width: {
    type: Number,
    default: 1920,
  },
  height: {
    type: Number,
    default: 1080,
  },
  steps: {
    type: Number,
    default: null,
  },
  cfgScale: {
    type: Number,
    default: null,
  },
  seed: {
    type: String,
    default: '',
  },
  
  // ✅ 分級與分類
  rating: {
    type: String,
    enum: ['all', '15', '18'],
    default: 'all',
  },
  category: {
    type: String,
    default: '',
  },
  
  // ✅ 完整度與分數
  completenessScore: {
    type: Number,
    default: 0,
  },
  hasMetadata: {
    type: Boolean,
    default: false,
  },
  popScore: {
    type: Number,
    default: 0,
  },
  initialBoost: {
    type: Number,
    default: 0,
  },
  
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },

  // ===== 內容生命週期管理（預留欄位） =====
  status: {
    type: String,
    enum: ['active', 'cold', 'archived', 'deleted'],
    default: 'active',
    index: true,
    comment: 'active=正常, cold=冷藏, archived=歸檔, deleted=已刪除'
  },

  // ===== 互動數據 =====
  viewCount: {
    type: Number,
    default: 0,
    index: true,
    comment: '觀看次數'
  },

  lastViewedAt: {
    type: Date,
    default: null,
    comment: '最後觀看時間'
  },

  lastInteractionAt: {
    type: Date,
    default: null,
    index: true,
    comment: '最後互動時間（點讚/評論/觀看）'
  },

  // ===== 冷藏/歸檔時間戳 =====
  coldAt: {
    type: Date,
    default: null,
    index: true,
    comment: '進入冷藏狀態的時間'
  },

  archivedAt: {
    type: Date,
    default: null,
    comment: '進入歸檔狀態的時間'
  },

  // ===== 保護標記 =====
  isPinned: {
    type: Boolean,
    default: false,
    index: true,
    comment: '用戶釘選的重要作品，永不冷藏'
  },

  pinnedAt: {
    type: Date,
    default: null,
    comment: '釘選時間'
  },

  isHighQuality: {
    type: Boolean,
    default: false,
    index: true,
    comment: '高質量內容標記（管理員或演算法判定），永不冷藏'
  },

  qualityScore: {
    type: Number,
    default: 0,
    comment: '質量評分（用於自動判定 isHighQuality）'
  },

  // ===== 管理員功能 =====
  adminNotes: {
    type: String,
    default: '',
    comment: '管理員備註'
  },

  forceActive: {
    type: Boolean,
    default: false,
    comment: '管理員強制保持活躍（永不冷藏）'
  },
}, {
  timestamps: true,
});

// 建立索引
VideoSchema.index({ author: 1 });
VideoSchema.index({ uploadDate: -1 });
VideoSchema.index({ likesCount: -1 });
VideoSchema.index({ views: -1 });
VideoSchema.index({ tags: 1 });
VideoSchema.index({ rating: 1, uploadDate: -1 });
VideoSchema.index({ hasMetadata: 1 });
VideoSchema.index({ popScore: -1 });

// ===== 內容生命週期管理索引（預留） =====
VideoSchema.index({ status: 1, popScore: -1 });
VideoSchema.index({ status: 1, uploadDate: -1 });
VideoSchema.index({ lastInteractionAt: -1 });
VideoSchema.index({ isPinned: 1, author: 1 });
VideoSchema.index({ isHighQuality: 1 });

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

export default Video;

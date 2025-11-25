import mongoose from 'mongoose';

const MusicAnalyticsSchema = new mongoose.Schema({
  musicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Music', 
    required: true, 
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null, 
    index: true 
  },
  sessionId: { 
    type: String, 
    required: true, 
    index: true 
  },
  eventType: {
    type: String,
    enum: ['play_start', 'play_pause', 'play_complete', 'buffering', 'error', 'repeat'],
    required: true,
    index: true
  },
  playProgress: { 
    type: Number, 
    default: null 
  }, // 0-100 百分比
  bufferDuration: { 
    type: Number, 
    default: null 
  }, // 秒
  bufferCount: { 
    type: Number, 
    default: 0 
  },
  totalPlayTime: { 
    type: Number, 
    default: null 
  }, // 秒
  errorType: { 
    type: String, 
    default: null 
  },
  deviceInfo: {
    type: { 
      type: String, 
      enum: ['mobile', 'desktop', 'tablet'],
      default: null
    },
    browser: { type: String, default: null },
    screenWidth: { type: Number, default: null },
    screenHeight: { type: Number, default: null },
  },
  networkInfo: {
    type: { 
      type: String, 
      enum: ['4g', '5g', 'wifi', 'unknown'],
      default: 'unknown'
    },
  },
  source: {
    type: String,
    enum: ['player', 'modal'],
    default: null, // null 表示舊數據或未指定來源（向後兼容）
    index: true
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: true,
    expires: 5184000 // 60天自動刪除（秒）
  },
});

// 索引優化
MusicAnalyticsSchema.index({ musicId: 1, createdAt: -1 });
MusicAnalyticsSchema.index({ sessionId: 1, createdAt: -1 });
MusicAnalyticsSchema.index({ eventType: 1, createdAt: -1 });
MusicAnalyticsSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.MusicAnalytics || mongoose.model('MusicAnalytics', MusicAnalyticsSchema);


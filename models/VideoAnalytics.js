import mongoose from 'mongoose';

const VideoAnalyticsSchema = new mongoose.Schema({
  videoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Video', 
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
    enum: ['play_start', 'play_complete', 'buffering', 'error', 'quality_change', 'abandon', 'like'],
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
  errorType: { 
    type: String, 
    default: null 
  },
  quality: { 
    type: String, 
    default: null 
  }, // '360p', '720p', '1080p'
  abandonPoint: { 
    type: Number, 
    default: null 
  }, // 放棄時的播放進度
  watchDuration: {
    type: Number,
    default: null
  }, // ✅ 觀看時長（秒）
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
VideoAnalyticsSchema.index({ videoId: 1, createdAt: -1 });
VideoAnalyticsSchema.index({ sessionId: 1, createdAt: -1 });
VideoAnalyticsSchema.index({ eventType: 1, createdAt: -1 });
VideoAnalyticsSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.VideoAnalytics || mongoose.model('VideoAnalytics', VideoAnalyticsSchema);


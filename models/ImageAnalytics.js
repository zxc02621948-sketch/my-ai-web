import mongoose from 'mongoose';

const ImageAnalyticsSchema = new mongoose.Schema({
  imageId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Image', 
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
    enum: ['view', 'open_modal', 'scroll_depth', 'like', 'comment', 'collect', 'exit'],
    required: true,
    index: true
  },
  scrollDepth: { 
    type: Number, 
    default: null 
  }, // 0-100 百分比
  timeSpent: { 
    type: Number, 
    default: null 
  }, // 秒
  exitPoint: { 
    type: String, 
    default: null 
  }, // 離開時的路徑
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
  }, // 額外數據
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: true,
    expires: 5184000 // 60天自動刪除（秒）
  },
});

// 索引優化
ImageAnalyticsSchema.index({ imageId: 1, createdAt: -1 });
ImageAnalyticsSchema.index({ sessionId: 1, createdAt: -1 });
ImageAnalyticsSchema.index({ eventType: 1, createdAt: -1 });
ImageAnalyticsSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ImageAnalytics || mongoose.model('ImageAnalytics', ImageAnalyticsSchema);


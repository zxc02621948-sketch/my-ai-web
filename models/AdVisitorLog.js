const mongoose = require('mongoose');

const AdVisitorLogSchema = new mongoose.Schema({
  path: { type: String, required: true },
  ip: { type: String, required: true },
  visitId: { type: String, required: true },
  userAgent: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referrer: { type: String, default: null }, // 來源頁面，用於廣告分析
  sessionId: { type: String, default: null }, // 會話ID，用於更精確的用戶行為分析
  createdAt: { type: Date, default: Date.now }
});

// 為廣告統計優化的索引
AdVisitorLogSchema.index({ createdAt: -1 });
AdVisitorLogSchema.index({ path: 1, createdAt: -1 });
AdVisitorLogSchema.index({ userId: 1, createdAt: -1 });
AdVisitorLogSchema.index({ ip: 1, createdAt: -1 });
AdVisitorLogSchema.index({ visitId: 1 });

module.exports = mongoose.models.AdVisitorLog || mongoose.model('AdVisitorLog', AdVisitorLogSchema);
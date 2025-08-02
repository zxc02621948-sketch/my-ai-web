// models/VisitorLog.js
import mongoose from 'mongoose';

const VisitorLogSchema = new mongoose.Schema({
  path: String,
  ip: String,
  userAgent: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.VisitorLog || mongoose.model('VisitorLog', VisitorLogSchema);

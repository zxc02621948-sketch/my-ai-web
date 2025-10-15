import { readFileSync } from 'fs';
import mongoose from 'mongoose';

// 手動解析 .env.local
const envConfig = readFileSync('.env.local', 'utf-8');
const envVars = {};
envConfig.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    envVars[key] = value;
  }
});

const MONGODB_URI = envVars.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI 未設定');
  process.exit(1);
}

// 導入模型
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { 
    type: String, 
    enum: ["comment", "reply", "new_image", "subscription_renewed", "subscription_cancelled", "subscription_expired", "subscription_expiring"], 
    required: true 
  },
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  text: { type: String },
  message: { type: String },
  link: { type: String },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  username: String,
  subscriptions: [{ type: Object }]
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

async function testNotification() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 找到第一個用戶
    const user = await User.findOne();
    if (!user) {
      console.log('❌ 沒有找到用戶');
      process.exit(1);
    }

    console.log(`\n📤 向用戶 ${user.username} 發送測試通知...`);

    // 創建一個測試通知
    const notification = await Notification.create({
      userId: user._id,
      type: 'subscription_expiring',
      message: '您的「釘選播放器」訂閱還有 3 天到期（2025/10/17）。前往商店續費，時間會累積延長！',
      link: '/store'
    });

    console.log('\n✅ 測試通知已發送！');
    console.log('通知內容:', {
      userId: user.username,
      type: notification.type,
      message: notification.message,
      link: notification.link
    });

    console.log('\n💡 請打開網站查看通知鈴鐺！');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 已斷開連接');
  }
}

testNotification();


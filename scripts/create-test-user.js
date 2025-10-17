const mongoose = require('mongoose');

// 連接到 MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myaiweb';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  pointsBalance: { type: Number, default: 0 },
  totalEarnedPoints: { type: Number, default: 0 },
  discussionPendingPoints: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 檢查是否已存在測試用戶
    const existingUser = await User.findOne({ email: 'testlike@example.com' });
    if (existingUser) {
      console.log('⚠️ 測試用戶已存在:', existingUser.username);
      console.log('📧 信箱: testlike@example.com');
      console.log('🔑 密碼: password123');
      return;
    }

    // 創建測試用戶
    const testUser = new User({
      email: 'testlike@example.com',
      password: 'password123', // 實際應該加密，但測試用
      username: '測試點讚者',
      pointsBalance: 100,
      totalEarnedPoints: 100,
      bio: '專門用來測試點讚功能的測試帳號'
    });

    await testUser.save();
    console.log('✅ 測試用戶創建成功！');
    console.log('📧 信箱: testlike@example.com');
    console.log('🔑 密碼: password123');
    console.log('👤 用戶名: 測試點讚者');
    console.log('💰 積分: 100');

    console.log('\n💡 使用說明:');
    console.log('1. 用這個帳號登入');
    console.log('2. 去討論區找到你的多圖教學帖');
    console.log('3. 點讚該帖子');
    console.log('4. 回到你的主帳號查看積分提領');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

createTestUser();

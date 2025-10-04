const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  pointsBalance: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function addTestUsers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');

    // 清除現有測試用戶
    await User.deleteMany({ email: { $regex: /^test/ } });
    console.log('🗑️ 已清除現有測試用戶');

    const testUsers = [
      {
        email: 'test1@example.com',
        password: 'password123',
        username: '創界者大師',
        pointsBalance: 5500,
        bio: '最高等級的創作者'
      },
      {
        email: 'test2@example.com',
        password: 'password123',
        username: '星級創作者',
        pointsBalance: 1200,
        bio: '專業的星級創作者'
      },
      {
        email: 'test3@example.com',
        password: 'password123',
        username: '探索者',
        pointsBalance: 750,
        bio: '熱愛探索的創作者'
      },
      {
        email: 'test4@example.com',
        password: 'password123',
        username: '創作者新手',
        pointsBalance: 200,
        bio: '剛開始創作的創作者'
      },
      {
        email: 'test5@example.com',
        password: 'password123',
        username: '啟程者',
        pointsBalance: 50,
        bio: '剛加入的新手'
      },
      {
        email: 'test6@example.com',
        password: 'password123',
        username: '積分達人',
        pointsBalance: 3000,
        bio: '積分收集愛好者'
      },
      {
        email: 'test7@example.com',
        password: 'password123',
        username: '藝術家',
        pointsBalance: 800,
        bio: '專注於藝術創作'
      },
      {
        email: 'test8@example.com',
        password: 'password123',
        username: '設計師',
        pointsBalance: 1500,
        bio: '專業設計師'
      }
    ];

    const result = await User.insertMany(testUsers);
    console.log(`✅ 成功添加 ${result.length} 個測試用戶`);

    // 顯示用戶信息
    result.forEach((user, i) => {
      console.log(`${i + 1}. ${user.username} - ${user.pointsBalance} 積分`);
    });

    console.log('🎉 測試用戶添加完成！');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

addTestUsers();

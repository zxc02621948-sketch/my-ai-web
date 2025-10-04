const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: true },
  isAdmin: { type: Boolean, default: false },
  pointsBalance: { type: Number, default: 0 },
  currentFrame: { type: String, default: 'default' },
  ownedFrames: [{ type: String, default: ['default'] }],
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function addAllFramesToUsers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');

    // 所有頭像框ID
    const allFrames = [
      'default', 'cat-ears', 'flame-ring', 'flower-wreath', 
      'ai-generated', 'animals', 'flowers', 'leaves'
    ];

    // 為所有用戶添加所有頭像框
    const result = await User.updateMany(
      {},
      { 
        $set: { 
          ownedFrames: allFrames
        }
      }
    );

    console.log(`✅ 已為 ${result.modifiedCount} 個用戶添加所有頭像框`);

    // 顯示一些用戶的頭像框信息
    const users = await User.find({}).limit(3).select('username currentFrame ownedFrames');
    console.log('📋 用戶頭像框信息：');
    users.forEach(user => {
      console.log(`- ${user.username}: 當前=${user.currentFrame}, 擁有=${user.ownedFrames.length} 個頭像框`);
    });

    console.log('🎉 所有頭像框已免費提供給所有用戶！');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

addAllFramesToUsers();

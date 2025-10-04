const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkAllUsersAvatars() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const users = await User.find({}).select('username email image avatar currentFrame').lean();
    
    console.log('📋 所有用戶的頭像信息：');
    users.forEach((user, index) => {
      console.log(`${index + 1}. 用戶名: ${user.username}`);
      console.log(`   - 郵箱: ${user.email}`);
      console.log(`   - image: ${user.image || '無'}`);
      console.log(`   - avatar: ${user.avatar || '無'}`);
      console.log(`   - 當前頭像框: ${user.currentFrame}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

checkAllUsersAvatars();

const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkUserAvatar() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const userId = '68844ed6ea9e04d4110aaf5c';
    const user = await User.findById(userId).select('username image avatar currentFrame ownedFrames').lean();
    
    if (user) {
      console.log('📋 用戶頭像信息：');
      console.log('- 用戶名:', user.username);
      console.log('- image 字段:', user.image);
      console.log('- avatar 字段:', user.avatar);
      console.log('- 當前頭像框:', user.currentFrame);
      console.log('- 擁有的頭像框:', user.ownedFrames);
    } else {
      console.log('❌ 找不到用戶');
    }
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

checkUserAvatar();

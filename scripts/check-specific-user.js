const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkSpecificUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const user = await User.findById('68844ed6ea9e04d4110aaf5c').lean();
    if (user) {
      console.log('📋 用戶詳細信息：');
      console.log('- 用戶名:', user.username);
      console.log('- 當前頭像框:', user.currentFrame);
      console.log('- 擁有的頭像框:', user.ownedFrames);
      console.log('- 是否為管理員:', user.isAdmin);
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

checkSpecificUser();

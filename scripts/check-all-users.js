const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkAllUsers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const users = await User.find({}).select('_id username currentFrame ownedFrames isAdmin').lean();
    console.log('📋 所有用戶信息：');
    users.forEach(user => {
      console.log(`- ID: ${user._id}, 用戶名: ${user.username}, 當前頭像框: ${user.currentFrame}, 擁有的頭像框: ${user.ownedFrames?.join(', ') || '無'}, 管理員: ${user.isAdmin}`);
    });
    
    // 特別檢查目標用戶
    const targetUser = await User.findById('68844ed6ea9e04d4110aaf5c').lean();
    if (targetUser) {
      console.log('\n🎯 目標用戶詳細信息：');
      console.log('- 用戶名:', targetUser.username);
      console.log('- 當前頭像框:', targetUser.currentFrame);
      console.log('- 擁有的頭像框:', targetUser.ownedFrames);
      console.log('- 是否為管理員:', targetUser.isAdmin);
    } else {
      console.log('\n❌ 找不到目標用戶 68844ed6ea9e04d4110aaf5c');
    }
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

checkAllUsers();

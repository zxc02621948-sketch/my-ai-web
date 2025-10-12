const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkCurrentUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    // 檢查所有用戶的狀態
    const users = await User.find({}).select('username miniPlayerPurchased ownedFrames').lean();
    console.log('📋 當前用戶狀態:');
    users.forEach(user => {
      console.log('- ' + user.username + ': miniPlayer=' + user.miniPlayerPurchased + ', ownedFrames=' + user.ownedFrames.length + ' 個');
    });
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}
checkCurrentUser();

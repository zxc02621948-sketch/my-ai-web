const mongoose = require('mongoose');
const User = require('../models/User').default;

async function fixUserData() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    // 修復所有用戶的 miniPlayerPurchased 字段
    const result = await User.updateMany(
      { miniPlayerPurchased: { $exists: false } },
      { $set: { miniPlayerPurchased: false } }
    );
    console.log('✅ 已修復 ' + result.modifiedCount + ' 個用戶的 miniPlayerPurchased 字段');
    
    // 檢查修復後的結果
    const users = await User.find({}).select('username miniPlayerPurchased ownedFrames').lean();
    console.log('📋 修復後的用戶數據:');
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
fixUserData();

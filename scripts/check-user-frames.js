const mongoose = require('mongoose');
const User = require('../models/User').default;

async function checkUserFrames() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const users = await User.find({}).select('username currentFrame ownedFrames').lean();
    console.log('📋 用戶頭像框信息：');
    users.forEach(user => {
      console.log(`- ${user.username}: 當前=${user.currentFrame}, 擁有=${user.ownedFrames?.join(', ') || '無'}`);
    });
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

checkUserFrames();

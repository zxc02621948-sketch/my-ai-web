const mongoose = require('mongoose');
const User = require('../models/User').default;

const ALL_FRAME_IDS = [
  "default",
  "cat-ears",
  "flame-ring",
  "flower-wreath",
  "ai-generated",
  "animals",
  "flowers",
  "leaves"
];

async function fixUserFrames() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    // 查找目標用戶
    const targetUserId = '68844ed6ea9e04d4110aaf5c';
    let user = await User.findById(targetUserId);
    
    if (!user) {
      console.log('❌ 找不到目標用戶，創建新用戶...');
      // 創建新用戶
      user = new User({
        _id: targetUserId,
        username: 'cvb120g',
        email: 'zxc02621948@gmail.com',
        password: 'temp-password', // 臨時密碼
        isAdmin: true,
        currentFrame: 'default',
        ownedFrames: ALL_FRAME_IDS
      });
      await user.save();
      console.log('✅ 已創建新用戶');
    } else {
      console.log('✅ 找到目標用戶，更新頭像框數據...');
      // 更新現有用戶
      user.currentFrame = 'default';
      user.ownedFrames = ALL_FRAME_IDS;
      await user.save();
      console.log('✅ 已更新用戶頭像框數據');
    }
    
    // 驗證結果
    const updatedUser = await User.findById(targetUserId).lean();
    console.log('📋 更新後的用戶信息：');
    console.log('- 用戶名:', updatedUser.username);
    console.log('- 當前頭像框:', updatedUser.currentFrame);
    console.log('- 擁有的頭像框:', updatedUser.ownedFrames?.join(', '));
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

fixUserFrames();

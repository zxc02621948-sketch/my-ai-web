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

async function updateUserFrames() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const targetUserId = '68844ed6ea9e04d4110aaf5c';
    
    // 直接更新用戶的頭像框數據
    const result = await User.findByIdAndUpdate(
      targetUserId,
      { 
        $set: { 
          currentFrame: 'default',
          ownedFrames: ALL_FRAME_IDS 
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log('✅ 已更新用戶頭像框數據');
      console.log('📋 更新後的用戶信息：');
      console.log('- 用戶名:', result.username);
      console.log('- 當前頭像框:', result.currentFrame);
      console.log('- 擁有的頭像框:', result.ownedFrames?.join(', '));
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

updateUserFrames();

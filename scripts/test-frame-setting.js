const mongoose = require('mongoose');
const User = require('../models/User').default;

async function testFrameSetting() {
  try {
    console.log('🔧 開始測試頭像框設置...');
    
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 數據庫連接成功');
    
    const userId = '68844ed6ea9e04d4110aaf5c';
    
    // 檢查設置前的狀態
    const userBefore = await User.findById(userId).select('currentFrame ownedFrames').lean();
    console.log('🔧 設置前狀態:', {
      currentFrame: userBefore?.currentFrame,
      ownedFrames: userBefore?.ownedFrames
    });
    
    // 設置頭像框
    const testFrame = 'cat-ears';
    console.log('🔧 設置頭像框為:', testFrame);
    
    const updateResult = await User.findByIdAndUpdate(
      userId,
      { currentFrame: testFrame },
      { new: true }
    );
    
    console.log('🔧 更新結果:', updateResult ? '成功' : '失敗');
    if (updateResult) {
      console.log('🔧 更新後的數據:', {
        currentFrame: updateResult.currentFrame,
        ownedFrames: updateResult.ownedFrames
      });
    }
    
    // 重新查詢確認
    const userAfter = await User.findById(userId).select('currentFrame ownedFrames').lean();
    console.log('🔧 重新查詢結果:', {
      currentFrame: userAfter?.currentFrame,
      ownedFrames: userAfter?.ownedFrames
    });
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

testFrameSetting();

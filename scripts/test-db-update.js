const mongoose = require('mongoose');
const User = require('../models/User').default;

async function testDbUpdate() {
  try {
    console.log('🔧 開始測試數據庫更新...');
    
    // 直接連接 MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 數據庫連接成功');
    
    const userId = '68844ed6ea9e04d4110aaf5c';
    const testImageUrl = 'https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-avatar-url/avatar';
    
    console.log('🔧 準備更新用戶頭像:', { userId, testImageUrl });
    
    // 測試更新
    const updateResult = await User.findByIdAndUpdate(userId, { 
      image: testImageUrl,
      avatar: testImageUrl 
    }, { new: true });
    
    console.log('🔧 更新結果:', updateResult ? '成功' : '失敗');
    if (updateResult) {
      console.log('🔧 更新後的數據:', {
        image: updateResult.image,
        avatar: updateResult.avatar
      });
    }
    
    // 重新查詢確認
    const user = await User.findById(userId).select('image avatar').lean();
    console.log('🔧 重新查詢結果:', {
      image: user?.image,
      avatar: user?.avatar
    });
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

testDbUpdate();

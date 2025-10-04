const mongoose = require('mongoose');
const User = require('../models/User').default;

async function setDefaultAvatar() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const userId = '68844ed6ea9e04d4110aaf5c';
    const defaultAvatarUrl = 'https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public';
    
    const result = await User.findByIdAndUpdate(
      userId,
      { 
        image: defaultAvatarUrl,
        avatar: defaultAvatarUrl
      },
      { new: true }
    );
    
    if (result) {
      console.log('✅ 已設置預設頭像');
      console.log('- 用戶名:', result.username);
      console.log('- 頭像 URL:', result.image);
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

setDefaultAvatar();

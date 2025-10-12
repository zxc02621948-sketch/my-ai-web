const mongoose = require('mongoose');

// 手動設置 MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cvb120g:j3j79ru06@my-ai-web.tvohp.mongodb.net/ai-creation-db?retryWrites=true&w=majority&appName=my-ai-web';

const User = require('../models/User').default;

async function checkPinnedPlayer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到數據庫');

    // 檢查 p77897 用戶（你正在操作的用戶）
    const user = await User.findById('688d7b8f37f458cc460f1438');
    
    if (!user) {
      console.log('❌ 找不到用戶 cvb120g');
      return;
    }

    console.log('\n用戶信息:');
    console.log('- ID:', user._id);
    console.log('- 用戶名:', user.username);
    console.log('\n釘選播放器數據:');
    console.log('- hasPinnedPlayer:', !!user.pinnedPlayer);
    console.log('- pinnedPlayer:', JSON.stringify(user.pinnedPlayer, null, 2));

    if (user.pinnedPlayer) {
      console.log('\n釘選詳情:');
      console.log('- 釘選的用戶ID:', user.pinnedPlayer.userId);
      console.log('- 釘選的用戶名:', user.pinnedPlayer.username);
      console.log('- 播放清單長度:', user.pinnedPlayer.playlist?.length || 0);
      console.log('- 釘選時間:', user.pinnedPlayer.pinnedAt);
      console.log('- 過期時間:', user.pinnedPlayer.expiresAt);
      console.log('- 是否過期:', user.pinnedPlayer.expiresAt < new Date());
    }

  } catch (error) {
    console.error('錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 已斷開數據庫連接');
  }
}

checkPinnedPlayer();


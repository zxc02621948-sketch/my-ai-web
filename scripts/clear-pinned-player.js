// scripts/clear-pinned-player.js
// 清除所有用戶的釘選播放器數據（測試用）

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');

// 讀取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

async function clearPinnedPlayers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    // 清除所有用戶的釘選播放器
    const result = await User.updateMany(
      { pinnedPlayer: { $exists: true } },
      { $unset: { pinnedPlayer: 1 } }
    );

    console.log('📌 清除釘選播放器:', {
      匹配數量: result.matchedCount,
      修改數量: result.modifiedCount
    });

    console.log('\n✅ 清除完成！');
    console.log('現在可以測試訂閱系統了。');

  } catch (error) {
    console.error('❌ 清除失敗:', error);
  } finally {
    await mongoose.disconnect();
  }
}

clearPinnedPlayers();


// scripts/test-grant-lv10-reward.js
// 直接給當前用戶發放 LV10 獎勵（用於測試）

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 讀取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  try {
    console.log('🔗 連接資料庫...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到資料庫\n');

    const User = require('../models/User').default;
    
    // 找到你的測試用戶
    const testUser = await User.findOne({ username: 'cvb120g' });
    
    if (!testUser) {
      console.log('❌ 找不到測試用戶 cvb120g');
      process.exit(1);
    }
    
    console.log('👤 找到用戶:', testUser.username);
    console.log('📊 當前積分:', testUser.totalEarnedPoints || 0);
    console.log('🎯 當前等級:', testUser.totalEarnedPoints >= 10000 ? 'LV10' : 'LV9-');
    console.log('📦 當前訂閱數:', testUser.subscriptions?.length || 0);
    
    if (testUser.subscriptions && testUser.subscriptions.length > 0) {
      console.log('\n📋 現有訂閱:');
      testUser.subscriptions.forEach((sub, idx) => {
        console.log(`   ${idx + 1}. ${sub.type}:`, {
          活躍: sub.isActive,
          到期: sub.expiresAt?.toISOString().split('T')[0]
        });
      });
    }
    
    console.log('\n🎁 手動發放 LV10 獎勵...');
    
    // 手動添加 LV10 永久訂閱
    const startDate = new Date();
    const expiresAt = new Date('2099-12-31'); // 永久
    
    // 檢查是否已有永久訂閱
    const existingPermanent = testUser.subscriptions?.find(s => s.type === 'pinPlayer' && s.isActive);
    
    if (existingPermanent) {
      console.log('⚠️  已有永久訂閱，跳過發放');
      console.log('   到期時間:', existingPermanent.expiresAt?.toISOString().split('T')[0]);
    } else {
      testUser.subscriptions.push({
        type: 'pinPlayer',
        startDate: startDate,
        expiresAt: expiresAt,
        isActive: true,
        monthlyCost: 0,
        lastRenewedAt: startDate
      });
      
      await testUser.save();
      
      console.log('✅ 成功發放 LV10 獎勵！');
      console.log('   訂閱類型: pinPlayer (永久)');
      console.log('   開始時間:', startDate.toISOString().split('T')[0]);
      console.log('   到期時間:', expiresAt.toISOString().split('T')[0]);
      console.log('   有效期: 永久');
    }
    
    console.log('\n📦 最終訂閱列表:');
    const updatedUser = await User.findById(testUser._id);
    updatedUser.subscriptions.forEach((sub, idx) => {
      const isPermanent = sub.expiresAt > new Date('2099-01-01');
      console.log(`   ${idx + 1}. ${sub.type}:`, {
        活躍: sub.isActive,
        到期: sub.expiresAt.toISOString().split('T')[0],
        類型: isPermanent ? '永久' : '限時'
      });
    });
    
    console.log('\n✅ 測試完成！');
    console.log('💡 現在可以去播放器頁面測試永久釘選功能');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 已斷開資料庫連接');
  }
}

main();


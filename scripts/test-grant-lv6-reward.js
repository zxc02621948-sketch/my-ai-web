// scripts/test-grant-lv6-reward.js
// 直接給當前用戶發放 LV6 獎勵（用於測試）

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
    console.log('🎯 當前等級:', testUser.totalEarnedPoints >= 3500 ? 'LV6+' : 'LV5-');
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
    
    console.log('\n🎁 手動發放 LV6 獎勵...');
    
    // 手動添加 LV6 訂閱獎勵
    const startDate = new Date();
    const expiresAt = new Date(startDate);
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 天後
    
    // 檢查是否已有試用訂閱
    const existingTrial = testUser.subscriptions?.find(s => s.type === 'pinPlayerTest' && s.isActive);
    
    if (existingTrial) {
      console.log('⚠️  已有試用訂閱，跳過發放');
      console.log('   到期時間:', existingTrial.expiresAt?.toISOString().split('T')[0]);
    } else {
      testUser.subscriptions.push({
        type: 'pinPlayerTest',
        startDate: startDate,
        expiresAt: expiresAt,
        isActive: true,
        monthlyCost: 0,
        lastRenewedAt: startDate
      });
      
      await testUser.save();
      
      console.log('✅ 成功發放 LV6 獎勵！');
      console.log('   訂閱類型: pinPlayerTest');
      console.log('   開始時間:', startDate.toISOString().split('T')[0]);
      console.log('   到期時間:', expiresAt.toISOString().split('T')[0]);
      console.log('   有效天數: 30 天');
    }
    
    console.log('\n📦 最終訂閱列表:');
    const updatedUser = await User.findById(testUser._id);
    updatedUser.subscriptions.forEach((sub, idx) => {
      const daysLeft = Math.ceil((new Date(sub.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`   ${idx + 1}. ${sub.type}:`, {
        活躍: sub.isActive,
        到期: sub.expiresAt.toISOString().split('T')[0],
        剩餘天數: daysLeft
      });
    });
    
    console.log('\n✅ 測試完成！');
    console.log('💡 現在可以去播放器頁面測試釘選功能');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 已斷開資料庫連接');
  }
}

main();


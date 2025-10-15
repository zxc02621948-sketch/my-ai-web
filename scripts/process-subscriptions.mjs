// scripts/process-subscriptions.js
// 每日定時任務：處理訂閱續費和到期

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Notification from '../models/Notification.js';

// 加載環境變量（手動讀取 .env.local）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
try {
  const envPath = join(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    // 移除 BOM 和空白
    const cleanLine = line.replace(/^\uFEFF/, '').trim();
    if (!cleanLine || cleanLine.startsWith('#')) return;
    
    const eqIndex = cleanLine.indexOf('=');
    if (eqIndex > 0) {
      const key = cleanLine.substring(0, eqIndex).trim();
      let value = cleanLine.substring(eqIndex + 1).trim();
      
      // 移除引號
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ 環境變量載入成功');
  console.log('📋 MONGODB_URI:', process.env.MONGODB_URI ? '已設置' : '未設置');
} catch (error) {
  console.error('❌ 載入 .env.local 失敗:', error.message);
}

// 如果還是沒有 MONGODB_URI，使用默認值（僅供開發測試）
if (!process.env.MONGODB_URI) {
  console.log('⚠️ 未找到 MONGODB_URI，請檢查 .env.local');
  process.exit(1);
}

// 訂閱配置
const SUBSCRIPTION_CONFIG = {
  pinPlayer: {
    name: "釘選播放器",
    monthlyCost: 100,
    durationDays: 30
  },
  pinPlayerTest: {
    name: "釘選播放器（測試）",
    monthlyCost: 10,
    durationMinutes: 1 // 1 分鐘
  }
};

async function processSubscriptions() {
  try {
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    const today = new Date();
    console.log(`\n📅 開始處理訂閱（${today.toLocaleString('zh-TW')}）\n`);

    // 找到所有需要續費的用戶
    const usersWithDueSubscriptions = await User.find({
      'subscriptions.nextBillingDate': { $lte: today },
      'subscriptions.isActive': true
    });

    console.log(`🔍 找到 ${usersWithDueSubscriptions.length} 個用戶需要處理訂閱\n`);

    let renewedCount = 0;
    let cancelledCount = 0;
    let skippedCount = 0;

    for (const user of usersWithDueSubscriptions) {
      console.log(`\n👤 處理用戶: ${user.username} (${user._id})`);
      console.log(`   當前積分: ${user.pointsBalance}`);

      let userModified = false;

      for (const subscription of user.subscriptions) {
        if (!subscription.isActive || subscription.nextBillingDate > today) {
          continue;
        }

        const config = SUBSCRIPTION_CONFIG[subscription.type];
        if (!config) {
          console.log(`   ⚠️ 未知的訂閱類型: ${subscription.type}`);
          continue;
        }

        console.log(`\n   📦 處理訂閱: ${config.name}`);
        console.log(`   - 月費: ${subscription.monthlyCost} 積分`);
        console.log(`   - 自動續費: ${subscription.autoRenew ? '是' : '否'}`);
        console.log(`   - 到期日: ${subscription.nextBillingDate.toLocaleString('zh-TW')}`);

        // 如果沒有啟用自動續費，直接取消
        if (!subscription.autoRenew) {
          subscription.isActive = false;
          subscription.cancelledAt = today;
          
          // 如果是釘選播放器，解除釘選
          if (subscription.type === 'pinPlayer' && user.pinnedPlayer) {
            user.pinnedPlayer = undefined;
            console.log('   📌 已解除釘選播放器');
          }
          
          userModified = true;
          cancelledCount++;
          
          console.log(`   ❌ 訂閱已取消（未啟用自動續費）`);
          
          // 發送通知
          await Notification.create({
            userId: user._id,
            type: 'subscription_expired',
            message: `您的「${config.name}」訂閱已到期（未啟用自動續費）`,
            link: '/store'
          });
          
          continue;
        }

        // 檢查積分是否足夠
        if (user.pointsBalance < subscription.monthlyCost) {
          // 積分不足，取消訂閱
          subscription.isActive = false;
          subscription.cancelledAt = today;
          
          // 如果是釘選播放器，解除釘選
          if (subscription.type === 'pinPlayer' && user.pinnedPlayer) {
            user.pinnedPlayer = undefined;
            console.log('   📌 已解除釘選播放器');
          }
          
          userModified = true;
          cancelledCount++;
          
          console.log(`   ❌ 訂閱已取消（積分不足: ${user.pointsBalance} < ${subscription.monthlyCost}）`);
          
          // 發送通知
          await Notification.create({
            userId: user._id,
            type: 'subscription_cancelled',
            message: `您的「${config.name}」訂閱因積分不足已自動取消。當前積分: ${user.pointsBalance}，需要: ${subscription.monthlyCost}`,
            link: '/store'
          });
          
          continue;
        }

        // 扣除積分並續費
        user.pointsBalance -= subscription.monthlyCost;
        
        // 更新下次扣款日期
        const newBillingDate = new Date(subscription.nextBillingDate);
        if (config.durationDays) {
          newBillingDate.setDate(newBillingDate.getDate() + config.durationDays);
        } else if (config.durationMinutes) {
          newBillingDate.setMinutes(newBillingDate.getMinutes() + config.durationMinutes);
        }
        subscription.nextBillingDate = newBillingDate;
        
        userModified = true;
        renewedCount++;
        
        console.log(`   ✅ 續費成功`);
        console.log(`   - 扣除積分: ${subscription.monthlyCost}`);
        console.log(`   - 剩餘積分: ${user.pointsBalance}`);
        console.log(`   - 下次扣款: ${newBillingDate.toLocaleString('zh-TW')}`);
        
        // 記錄積分交易
        const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
        await PointsTransaction.create({
          userId: user._id,
          points: -subscription.monthlyCost,
          type: 'admin_gift', // 使用現有的 enum 值（訂閱續費）
          dateKey: dateKey,
          meta: {
            subscriptionType: subscription.type,
            action: 'renew',
            description: `${config.name} 月租續費`
          }
        });
        
        // 發送續費成功通知
        await Notification.create({
          userId: user._id,
          type: 'subscription_renewed',
          message: `「${config.name}」已自動續費，扣除 ${subscription.monthlyCost} 積分。下次扣款: ${newBillingDate.toLocaleDateString('zh-TW')}`
        });
      }

      // 保存用戶數據
      if (userModified) {
        await user.save();
        console.log(`   💾 用戶數據已保存`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n\n📊 處理完成統計:`);
    console.log(`   ✅ 續費成功: ${renewedCount}`);
    console.log(`   ❌ 取消訂閱: ${cancelledCount}`);
    console.log(`   ⏭️ 跳過: ${skippedCount}`);
    console.log(`   📦 總處理: ${usersWithDueSubscriptions.length}\n`);

  } catch (error) {
    console.error('❌ 處理訂閱失敗:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 數據庫連接已關閉');
  }
}

// 執行
processSubscriptions();


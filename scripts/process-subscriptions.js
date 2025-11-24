// scripts/process-subscriptions.js
// 每日定時任務：處理訂閱續費和到期

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Notification from '../models/Notification.js';

// 加載環境變量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// 訂閱配置
const SUBSCRIPTION_CONFIG = {
  pinPlayer: {
    name: "釘選播放器",
    monthlyCost: 200,
    durationDays: 30
  },
};

async function processSubscriptions() {
  try {
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    const today = new Date();
    console.log(`\n📅 開始處理訂閱（${today.toLocaleString('zh-TW')}）\n`);

    // ✅ 找到所有需要續費的用戶（使用 expiresAt 或 nextBillingDate）
    const usersWithDueSubscriptions = await User.find({
      'subscriptions.isActive': true,
      $or: [
        { 'subscriptions.nextBillingDate': { $lte: today } },
        { 
          'subscriptions.nextBillingDate': { $exists: false },
          'subscriptions.expiresAt': { $lte: today }
        }
      ]
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
        if (!subscription.isActive) {
          continue;
        }
        
        // ✅ 檢查是否需要續費（使用 nextBillingDate 或 expiresAt）
        const billingDate = subscription.nextBillingDate || subscription.expiresAt;
        if (!billingDate || new Date(billingDate) > today) {
          continue;
        }

        const config = SUBSCRIPTION_CONFIG[subscription.type];
        if (!config) {
          console.log(`   ⚠️ 未知的訂閱類型: ${subscription.type}`);
          continue;
        }

        console.log(`\n   📦 處理訂閱: ${config.name}`);
        console.log(`   - 月費: ${subscription.monthlyCost} 積分`);
        console.log(`   - 自動續費: ${subscription.autoRenew !== false ? '是' : '否'}`); // ✅ 默認為 true
        console.log(`   - 到期日: ${new Date(billingDate).toLocaleString('zh-TW')}`);

        // ✅ 如果沒有啟用自動續費（明確設置為 false），直接取消
        // 注意：autoRenew 默認為 true，所以只有明確設置為 false 時才取消
        if (subscription.autoRenew === false) {
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
        
        // ✅ 更新到期時間和下次扣款日期（累積制）
        // 使用 expiresAt 作為基準（如果沒有則使用 nextBillingDate）
        const baseTime = subscription.expiresAt 
          ? new Date(subscription.expiresAt) 
          : new Date(subscription.nextBillingDate);
        
        const addedDuration = config.durationDays 
          ? config.durationDays * 24 * 60 * 60 * 1000 
          : (config.durationMinutes ? config.durationMinutes * 60 * 1000 : 0);
        
        const newExpiresAt = new Date(baseTime.getTime() + addedDuration);
        subscription.expiresAt = newExpiresAt; // ✅ 更新到期時間
        subscription.nextBillingDate = newExpiresAt; // ✅ 更新下次扣款日期
        
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


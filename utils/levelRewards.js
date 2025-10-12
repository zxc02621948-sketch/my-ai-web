// utils/levelRewards.js
// 等級獎勵配置

export const LEVEL_REWARDS = {
  lv2: {
    frames: ['leaves'], // 葉子頭像框
    description: '恭喜達到 LV2！獲得葉子頭像框'
  },
  lv3: {
    features: ['music-player'], // 播放器功能
    description: '恭喜達到 LV3！解鎖播放器功能'
  },
  // LV4-10 獎勵設計
  lv4: {
    features: ['advanced-frames'], // 高級頭像框編輯功能
    description: '恭喜達到 LV4！解鎖高級頭像框編輯功能'
  },
  lv5: {
    features: ['priority-support'], // 優先客服支持
    points: 100, // 一次性積分獎勵
    description: '恭喜達到 LV5！獲得優先客服支持 + 100 積分獎勵'
  },
  lv6: {
    features: ['exclusive-frames'], // 獨家頭像框
    frames: ['premium-gold'], // 金色頭像框
    description: '恭喜達到 LV6！解鎖獨家頭像框並獲得金色頭像框'
  },
  lv7: {
    features: ['advanced-analytics'], // 高級數據分析
    points: 200, // 一次性積分獎勵
    description: '恭喜達到 LV7！解鎖高級數據分析功能 + 200 積分獎勵'
  },
  lv8: {
    features: ['early-access'], // 新功能優先體驗
    points: 300, // 一次性積分獎勵
    description: '恭喜達到 LV8！獲得新功能優先體驗權限 + 300 積分獎勵'
  },
  lv9: {
    features: ['beta-tester'], // Beta 測試員
    frames: ['beta-tester'], // Beta 測試員專屬頭像框
    points: 500, // 一次性積分獎勵
    description: '恭喜達到 LV9！成為 Beta 測試員 + 500 積分獎勵'
  },
  lv10: {
    features: ['founder-status'], // 創始人身份
    frames: ['founder-crown'], // 創始人皇冠頭像框
    points: 1000, // 一次性積分獎勵
    description: '恭喜達到最高等級 LV10！獲得創始人身份 + 1000 積分獎勵'
  },
};

/**
 * 檢查並發放等級獎勵
 * @param {Object} user - 用戶對象
 * @param {number} oldLevel - 舊等級索引
 * @param {number} newLevel - 新等級索引
 * @returns {Object} - 獎勵信息
 */
export async function grantLevelRewards(user, oldLevel, newLevel) {
  const rewards = {
    frames: [],
    features: [],
    points: 0,
    messages: []
  };

  // 遍歷從舊等級到新等級之間的所有等級
  for (let i = oldLevel + 1; i <= newLevel; i++) {
    const levelKey = `lv${i + 1}`; // i 是索引，levelKey 是 lv1, lv2...
    const reward = LEVEL_REWARDS[levelKey];
    
    if (!reward) continue; // 沒有獎勵，跳過
    
    // 發放頭像框
    if (reward.frames && Array.isArray(reward.frames)) {
      for (const frameId of reward.frames) {
        if (!user.ownedFrames.includes(frameId)) {
          user.ownedFrames.push(frameId);
          rewards.frames.push(frameId);
        }
      }
    }
    
    // 發放功能解鎖
    if (reward.features && Array.isArray(reward.features)) {
      for (const feature of reward.features) {
        // 處理播放器功能解鎖
        if (feature === 'music-player') {
          user.miniPlayerPurchased = true;
        }
        // 處理頭像框調色盤功能解鎖
        if (feature === 'frame-color-editor') {
          user.frameColorEditorUnlocked = true;
        }
        // 其他功能可以在這裡添加
      }
      rewards.features.push(...reward.features);
    }
    
    // 發放積分
    if (reward.points) {
      user.pointsBalance = (user.pointsBalance || 0) + reward.points;
      rewards.points += reward.points;
    }
    
    // 添加消息
    if (reward.description) {
      rewards.messages.push(reward.description);
    }
  }
  
  return rewards;
}

/**
 * 檢查用戶是否解鎖了特定功能
 * @param {Object} user - 用戶對象
 * @param {number} userLevel - 用戶等級索引
 * @param {string} featureId - 功能 ID
 * @returns {boolean}
 */
export function hasFeatureUnlocked(user, userLevel, featureId) {
  // 檢查是否達到解鎖等級
  for (let i = 0; i <= userLevel; i++) {
    const levelKey = `lv${i + 1}`;
    const reward = LEVEL_REWARDS[levelKey];
    if (reward && reward.features && reward.features.includes(featureId)) {
      return true;
    }
  }
  return false;
}


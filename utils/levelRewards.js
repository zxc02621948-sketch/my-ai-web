// utils/levelRewards.js
// 等級獎勵配置

export const LEVEL_REWARDS = {
  lv2: {
    frames: ['leaves'], // 葉子頭像框
    features: ['frame-color-editor'], // 調色盤功能（使用需付費 20 積分/次）
    description: '恭喜達到 LV2！獲得葉子頭像框 + 解鎖頭像框調色盤功能（使用需 20 積分/次）'
  },
  lv3: {
    features: ['music-player'], // 播放器功能
    description: '恭喜達到 LV3！解鎖播放器功能'
  },
  // LV4-10 獎勵設計
  lv4: {
    frames: ['military'], // 戰損軍事頭像框
    description: '恭喜達到 LV4！獲得戰損軍事頭像框'
  },
  lv5: {
    frames: ['nature'], // 花園自然頭像框
    description: '恭喜達到 LV5！獲得花園自然頭像框'
  },
  lv6: {
    features: ['pinned-player-trial'], // 免費釘選播放器 30 天
    description: '恭喜達到 LV6！獲得免費釘選播放器 30 天'
  },
  // LV7-LV9 暫無特殊獎勵（未來補充）
  lv10: {
    features: ['pinned-player-permanent'], // 永久釘選播放器
    description: '恭喜達到最高等級 LV10！獲得永久釘選播放器'
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
        // 處理釘選播放器試用（30天）
        if (feature === 'pinned-player-trial') {
          rewards.subscriptionTrial = {
            type: 'pinned-player',
            duration: 30 // 天數
          };
        }
        // 處理永久釘選播放器
        if (feature === 'pinned-player-permanent') {
          rewards.subscriptionPermanent = {
            type: 'pinned-player'
          };
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


/**
 * 全局音頻管理器 - 單一音源 + 優先度系統
 * 
 * 優先度定義：
 * - 3: 音樂 Modal（最高優先度）
 * - 2: 預覽（中等優先度）
 * - 1: 主播放器（最低優先度）
 */

import { debugLog, debugWarn } from './debug.js';

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentPriority = 0;
  }

  /**
   * 請求播放權限
   * @param {HTMLAudioElement} audio - 音頻元素
   * @param {number} priority - 優先度（1-3）
   * @returns {boolean} - 是否允許播放
   */
  requestPlay(audio, priority) {
    if (!audio || priority < 1 || priority > 3) {
      return false;
    }

    // 如果新音頻優先度更高，暫停當前音頻
    if (priority > this.currentPriority) {
      if (this.currentAudio && this.currentAudio !== audio && !this.currentAudio.paused) {
        try {
          // 暫停音頻元素（這會觸發 pause 事件，讓播放器更新狀態）
          this.currentAudio.pause();
          debugLog("🎵 [AudioManager] 暫停低優先度音頻，優先度:", this.currentPriority, "->", priority);
          
          // 觸發自定義事件，通知播放器狀態已改變（確保狀態同步）
          try {
            const pauseEvent = new CustomEvent("audioManagerPaused", {
              detail: { audio: this.currentAudio, priority: this.currentPriority }
            });
            window.dispatchEvent(pauseEvent);
          } catch (e) {
            // 忽略事件觸發錯誤
          }
        } catch (error) {
          debugWarn("🎵 [AudioManager] 暫停當前音頻失敗:", error);
        }
      }
      this.currentAudio = audio;
      this.currentPriority = priority;
      return true; // 允許播放
    }

    // 如果優先度相等或更高，也允許播放（同一個音頻重新請求）
    if (priority === this.currentPriority && this.currentAudio === audio) {
      return true;
    }

    // 優先度不夠，不允許播放
    return false;
  }

  /**
   * 釋放音頻
   * @param {HTMLAudioElement} audio - 音頻元素（可選，如果提供則只釋放匹配的）
   */
  release(audio = null) {
    // 如果提供了 audio 參數，只釋放匹配的音頻
    if (audio) {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentPriority = 0;
      }
    } else {
      // 如果沒有提供 audio 參數，強制釋放所有音頻（用於清理）
      this.currentAudio = null;
      this.currentPriority = 0;
    }
  }

  /**
   * 獲取當前播放的音頻
   * @returns {HTMLAudioElement|null}
   */
  getCurrentAudio() {
    return this.currentAudio;
  }

  /**
   * 獲取當前優先度
   * @returns {number}
   */
  getCurrentPriority() {
    return this.currentPriority;
  }
}

// 導出單例
export const audioManager = new AudioManager();

// ✅ 掛載到 window，方便其他組件訪問
if (typeof window !== 'undefined') {
  window.audioManager = audioManager;
}


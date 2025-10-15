/**
 * 隱藏播放器檢測腳本
 * 檢測所有可能的音頻播放源
 */

class HiddenPlayerDetector {
  constructor() {
    this.audioSources = [];
    this.youtubePlayers = [];
    this.startDetection();
  }

  // 檢測所有音頻元素
  detectAudioElements() {
    const audioElements = document.querySelectorAll('audio');
    const videoElements = document.querySelectorAll('video');
    
    console.log('🔍 檢測到的音頻元素:', audioElements.length);
    console.log('🔍 檢測到的視頻元素:', videoElements.length);
    
    audioElements.forEach((audio, index) => {
      console.log(`音頻元素 ${index}:`, {
        src: audio.src,
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration,
        volume: audio.volume
      });
    });
    
    videoElements.forEach((video, index) => {
      console.log(`視頻元素 ${index}:`, {
        src: video.src,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        volume: video.volume
      });
    });
  }

  // 檢測 YouTube 播放器
  detectYouTubePlayers() {
    const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
    console.log('🔍 檢測到的 YouTube iframe:', iframes.length);
    
    iframes.forEach((iframe, index) => {
      console.log(`YouTube iframe ${index}:`, {
        src: iframe.src,
        style: iframe.style.cssText,
        hidden: iframe.style.display === 'none' || iframe.style.visibility === 'hidden'
      });
    });
  }

  // 檢測全局播放器狀態
  detectGlobalPlayerState() {
    console.log('🔍 全局播放器狀態檢測:');
    
    // 檢查 PlayerContext
    if (window.playerContext) {
      console.log('PlayerContext 狀態:', {
        isPlaying: window.playerContext.isPlaying,
        src: window.playerContext.src,
        originUrl: window.playerContext.originUrl,
        currentTime: window.playerContext.currentTime
      });
    }
    
    // 檢查 YouTube 播放器
    if (window.ytPlayer) {
      try {
        console.log('YouTube 播放器狀態:', {
          playerState: window.ytPlayer.getPlayerState(),
          currentTime: window.ytPlayer.getCurrentTime(),
          duration: window.ytPlayer.getDuration(),
          volume: window.ytPlayer.getVolume()
        });
      } catch (error) {
        console.log('YouTube 播放器狀態獲取失敗:', error.message);
      }
    }
  }

  // 強制暫停所有音頻
  forcePauseAll() {
    console.log('🔧 強制暫停所有音頻源...');
    
    // 暫停所有音頻元素
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach((audio, index) => {
      audio.pause();
      console.log(`暫停音頻元素 ${index}`);
    });
    
    // 暫停所有視頻元素
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video, index) => {
      video.pause();
      console.log(`暫停視頻元素 ${index}`);
    });
    
    // 暫停 YouTube 播放器
    if (window.ytPlayer) {
      try {
        window.ytPlayer.pauseVideo();
        console.log('暫停 YouTube 播放器');
      } catch (error) {
        console.log('YouTube 播放器暫停失敗:', error.message);
      }
    }
    
    // 暫停 PlayerContext
    if (window.playerContext && window.playerContext.pause) {
      window.playerContext.pause();
      console.log('暫停 PlayerContext');
    }
  }

  // 開始檢測
  startDetection() {
    console.log('🔍 開始隱藏播放器檢測...');
    
    setTimeout(() => {
      this.detectAudioElements();
      this.detectYouTubePlayers();
      this.detectGlobalPlayerState();
    }, 2000);
  }

  // 生成報告
  generateReport() {
    console.log('\n🔍 隱藏播放器檢測報告');
    console.log('='.repeat(50));
    
    const audioElements = document.querySelectorAll('audio');
    const videoElements = document.querySelectorAll('video');
    const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
    
    console.log(`音頻元素: ${audioElements.length}`);
    console.log(`視頻元素: ${videoElements.length}`);
    console.log(`YouTube iframe: ${youtubeIframes.length}`);
    
    // 檢查是否有隱藏的播放器
    let hiddenPlayers = 0;
    
    audioElements.forEach(audio => {
      if (!audio.paused && (audio.style.display === 'none' || audio.style.visibility === 'hidden')) {
        hiddenPlayers++;
        console.log('🔴 發現隱藏的音頻播放器:', audio.src);
      }
    });
    
    videoElements.forEach(video => {
      if (!video.paused && (video.style.display === 'none' || video.style.visibility === 'hidden')) {
        hiddenPlayers++;
        console.log('🔴 發現隱藏的視頻播放器:', video.src);
      }
    });
    
    if (hiddenPlayers > 0) {
      console.log(`❌ 發現 ${hiddenPlayers} 個隱藏播放器！`);
    } else {
      console.log('✅ 未發現隱藏播放器');
    }
  }
}

// 全局檢測函數
window.detectHiddenPlayers = () => {
  const detector = new HiddenPlayerDetector();
  return detector;
};

// 強制暫停所有播放器
window.forcePauseAll = () => {
  const detector = new HiddenPlayerDetector();
  detector.forcePauseAll();
};

// 自動開始檢測
if (typeof window !== 'undefined') {
  console.log('🔍 隱藏播放器檢測器已載入');
  console.log('💡 使用 window.detectHiddenPlayers() 來開始檢測');
  console.log('💡 使用 window.forcePauseAll() 來強制暫停所有播放器');
  
  // 自動開始檢測
  setTimeout(() => {
    window.detectHiddenPlayers();
  }, 3000);
}





# 影片分數診斷腳本

## 🔍 **完整診斷**

複製以下代碼到瀏覽器 Console (F12)：

```javascript
console.log('🔍 開始完整診斷...\n');

// 步驟 1: 檢查 API 回傳的原始數據
fetch('/api/videos?page=1&limit=10&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.log('📊 API 回傳數據：\n');
    
    data.videos.forEach((v, i) => {
      console.log(`═══════════════════════════════════════`);
      console.log(`📹 影片 ${i + 1}: ${v.title}`);
      console.log(`───────────────────────────────────────`);
      
      // 基礎數據
      console.log('📋 基礎數據（資料庫）:');
      console.log(`  popScore (DB):        ${v.popScore || 0}`);
      console.log(`  likesCount:           ${v.likesCount || 0}`);
      console.log(`  likes (array):        ${Array.isArray(v.likes) ? v.likes.length : 'N/A'}`);
      console.log(`  views:                ${v.views || 0}`);
      console.log(`  clicks:               ${v.clicks || 0}`);
      console.log(`  completenessScore:    ${v.completenessScore || 0}`);
      console.log(`  initialBoost:         ${v.initialBoost || 0}`);
      
      // 時間相關
      console.log('\n⏰ 時間資訊:');
      const createdAt = new Date(v.createdAt || v.uploadDate);
      const now = new Date();
      const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
      console.log(`  上傳時間:             ${createdAt.toLocaleString()}`);
      console.log(`  經過時間:             ${hoursElapsed.toFixed(2)} 小時`);
      
      // 計算預期分數
      console.log('\n🧮 分數計算:');
      const clickScore = (v.clicks || 0) * 1.0;
      const likeScore = (v.likesCount || 0) * 8.0;
      const viewScore = (v.views || 0) * 0.5;
      const completeScore = (v.completenessScore || 0) * 0.05;
      
      // 計算衰減後的 boost
      const boostFactor = hoursElapsed < 10 
        ? Math.max(0, 1 - hoursElapsed / 10) 
        : 0;
      const decayedBoost = Math.round((v.initialBoost || 0) * boostFactor * 10) / 10;
      
      console.log(`  點擊分數 (clicks × 1.0):        ${clickScore}`);
      console.log(`  點讚分數 (likes × 8.0):         ${likeScore}`);
      console.log(`  觀看分數 (views × 0.5):         ${viewScore}`);
      console.log(`  完整度分數 (complete × 0.05):   ${completeScore}`);
      console.log(`  新影片加成 (初始 × 衰減):       ${v.initialBoost || 0} × ${boostFactor.toFixed(3)} = ${decayedBoost}`);
      
      const expectedScore = clickScore + likeScore + viewScore + completeScore + decayedBoost;
      console.log(`\n  ✅ 預期總分:                     ${expectedScore.toFixed(2)}`);
      
      // 即時計算分數（API 返回）
      if (v.livePopScore !== undefined) {
        console.log(`  📊 API 即時分數:                 ${v.livePopScore}`);
      }
      
      // 診斷問題
      console.log('\n🔍 診斷:');
      if (expectedScore === 0) {
        console.log('  ⚠️ 所有數據都是 0！');
        if ((v.likesCount || 0) === 0 && Array.isArray(v.likes) && v.likes.length > 0) {
          console.log('  ❌ likesCount 沒有同步！likes 陣列有 ' + v.likes.length + ' 個，但 likesCount = 0');
        }
      } else if (likeScore > 0) {
        console.log(`  ✅ 有點讚分數: ${likeScore} 分`);
      }
      
      console.log('');
    });
    
    // 統計
    console.log(`═══════════════════════════════════════`);
    console.log('📈 統計資訊：');
    const allZero = data.videos.every(v => (v.popScore || 0) === 0);
    const hasLikes = data.videos.filter(v => (v.likesCount || 0) > 0);
    
    console.log(`  總影片數:           ${data.videos.length}`);
    console.log(`  分數都是 0:         ${allZero ? '是 ⚠️' : '否 ✅'}`);
    console.log(`  有點讚的影片:       ${hasLikes.length} 個`);
    
    if (hasLikes.length > 0) {
      console.log('\n  有讚的影片:');
      hasLikes.forEach(v => {
        const likeScore = (v.likesCount || 0) * 8.0;
        console.log(`    - ${v.title}: ${v.likesCount} 讚 → 應得 ${likeScore} 分 (實際 DB: ${v.popScore || 0})`);
      });
    }
    
    console.log(`\n═══════════════════════════════════════`);
    console.log('💡 結論與建議：');
    
    if (allZero) {
      console.log('  ⚠️ 所有影片的資料庫分數都是 0');
      console.log('  📝 解決方式：');
      console.log('     1. 執行修復 API 更新資料庫分數');
      console.log('     2. 或確保使用 live=1 參數（即時計算）');
    } else {
      console.log('  ✅ 資料庫有分數，檢查是否正確排序');
    }
    
    if (hasLikes.length > 0) {
      const syncIssues = hasLikes.filter(v => {
        const likeScore = (v.likesCount || 0) * 8.0;
        const dbScore = v.popScore || 0;
        return Math.abs(dbScore - likeScore) > 10; // 容許誤差
      });
      
      if (syncIssues.length > 0) {
        console.log('\n  ⚠️ 發現分數不同步問題！');
        console.log('     建議執行修復 API');
      }
    }
  })
  .catch(err => {
    console.error('❌ 錯誤:', err);
  });
```

---

## 🛠️ **如果發現問題**

### **問題 1：likesCount 沒有同步**

症狀：`likes` 陣列有資料，但 `likesCount` = 0

**解決方式：** 執行修復 API

```javascript
fetch('/api/admin/fix-video-music-scores', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('✅ 修復完成！', data);
  location.reload(); // 重新載入頁面
});
```

---

### **問題 2：所有基礎數據都是 0**

症狀：`clicks`, `views`, `likesCount` 都是 0

**原因：** 新上傳的影片還沒有互動

**解決方式：**
1. 點擊影片（增加 `clicks`）
2. 點愛心（增加 `likesCount`）
3. 播放影片（增加 `views`）

---

### **問題 3：有點讚但分數還是 0**

症狀：`likesCount > 0` 但 `popScore = 0`

**原因：** 資料庫分數沒有更新

**解決方式：** 執行修復 API（見上面）

---

## 🎯 **快速修復命令**

全部一次執行：

```javascript
// 1. 檢查問題
fetch('/api/videos?page=1&limit=5')
  .then(res => res.json())
  .then(data => {
    const v = data.videos[0];
    console.log('影片:', v.title);
    console.log('likesCount:', v.likesCount);
    console.log('likes 陣列:', Array.isArray(v.likes) ? v.likes.length : 'N/A');
    console.log('popScore:', v.popScore);
    
    // 2. 如果有問題，自動執行修復
    if ((v.likesCount > 0 || v.likes?.length > 0) && (v.popScore || 0) === 0) {
      console.log('\n⚠️ 發現分數問題，開始修復...');
      
      return fetch('/api/admin/fix-video-music-scores', {
        method: 'POST',
        credentials: 'include'
      });
    } else {
      console.log('\n✅ 分數正常');
      return null;
    }
  })
  .then(res => {
    if (res) {
      return res.json();
    }
  })
  .then(data => {
    if (data) {
      console.log('✅ 修復完成！', data);
      console.log('請重新整理頁面');
    }
  })
  .catch(err => console.error('❌ 錯誤:', err));
```


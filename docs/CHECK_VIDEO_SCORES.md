# 檢查影片熱門度分數

## 🔍 **方法 1：在瀏覽器 Console 查詢**

### **查詢所有影片的分數：**

```javascript
fetch('/api/videos?page=1&limit=50&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.log(`📊 總共 ${data.videos.length} 個影片\n`);
    
    const scores = data.videos.map(v => ({
      標題: v.title,
      熱門度: v.popScore || 0,
      新影片加成: v.initialBoost || 0,
      點讚數: v.likesCount || 0,
      觀看數: v.views || 0,
      點擊數: v.clicks || 0,
      完整度: v.completenessScore || 0,
      ID: v._id
    }));
    
    console.table(scores);
    
    // 按熱門度排序顯示
    console.log('\n🔥 熱門度排行：');
    scores.sort((a, b) => b.熱門度 - a.熱門度);
    scores.forEach((v, i) => {
      console.log(`${i+1}. ${v.標題} - 分數: ${v.熱門度}`);
    });
  });
```

---

### **查詢特定影片的詳細分數：**

```javascript
// 方法 1：透過影片 ID 查詢
const videoId = '你的影片ID'; // 替換為實際 ID

fetch(`/api/videos?page=1&limit=100`)
  .then(res => res.json())
  .then(data => {
    const video = data.videos.find(v => v._id === videoId);
    if (video) {
      console.log('📹 影片詳情：');
      console.log('標題:', video.title);
      console.log('熱門度 (popScore):', video.popScore || 0);
      console.log('新影片加成 (initialBoost):', video.initialBoost || 0);
      console.log('點讚數 (likesCount):', video.likesCount || 0);
      console.log('觀看數 (views):', video.views || 0);
      console.log('點擊數 (clicks):', video.clicks || 0);
      console.log('完整度 (completenessScore):', video.completenessScore || 0);
      console.log('\n計算方式:');
      console.log(`  點擊 × 1.0 = ${(video.clicks || 0) * 1.0}`);
      console.log(`  點讚 × 8.0 = ${(video.likesCount || 0) * 8.0}`);
      console.log(`  觀看 × 0.5 = ${(video.views || 0) * 0.5}`);
      console.log(`  完整度 × 0.05 = ${(video.completenessScore || 0) * 0.05}`);
      console.log(`  新影片加成 = ${video.initialBoost || 0}`);
      console.log(`  總分 = ${video.popScore || 0}`);
    } else {
      console.log('找不到影片');
    }
  });
```

---

### **比較兩個影片的分數：**

```javascript
fetch('/api/videos?page=1&limit=100')
  .then(res => res.json())
  .then(data => {
    console.log('📊 所有影片列表：');
    data.videos.forEach((v, i) => {
      console.log(`${i+1}. ${v.title} (ID: ${v._id})`);
    });
    
    console.log('\n請記下你想比較的兩個影片的編號，然後執行下面的代碼');
  });

// 執行完上面的代碼後，記下編號，然後執行這個（修改編號）：
fetch('/api/videos?page=1&limit=100')
  .then(res => res.json())
  .then(data => {
    const video1 = data.videos[0]; // 第 1 個影片（編號改為 0, 1, 2...）
    const video2 = data.videos[1]; // 第 2 個影片
    
    console.log('🆚 影片比較：\n');
    
    console.log('📹 影片 1:', video1.title);
    console.log('  熱門度:', video1.popScore || 0);
    console.log('  點讚數:', video1.likesCount || 0);
    console.log('  觀看數:', video1.views || 0);
    console.log('  點擊數:', video1.clicks || 0);
    console.log('  完整度:', video1.completenessScore || 0);
    console.log('  新影片加成:', video1.initialBoost || 0);
    
    console.log('\n📹 影片 2:', video2.title);
    console.log('  熱門度:', video2.popScore || 0);
    console.log('  點讚數:', video2.likesCount || 0);
    console.log('  觀看數:', video2.views || 0);
    console.log('  點擊數:', video2.clicks || 0);
    console.log('  完整度:', video2.completenessScore || 0);
    console.log('  新影片加成:', video2.initialBoost || 0);
    
    console.log('\n🎯 分數差距:', (video1.popScore || 0) - (video2.popScore || 0));
  });
```

---

## 🔍 **方法 2：檢查 API 回傳的即時計算**

影片頁面使用 `live=1` 參數，會即時計算熱門度：

```javascript
// 查看即時計算的分數
fetch('/api/videos?page=1&limit=10&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.log('🔴 即時計算模式：\n');
    data.videos.forEach(v => {
      console.log(`📹 ${v.title}`);
      console.log(`  資料庫分數 (popScore): ${v.popScore || 0}`);
      console.log(`  即時計算分數: 將在前端顯示`);
      console.log('');
    });
  });
```

---

## 🎯 **熱門度公式**

```
popScore = 
  (clicks × 1.0) +           // 點擊權重：1.0
  (likesCount × 8.0) +       // 點讚權重：8.0 （最重要！）
  (views × 0.5) +            // 觀看權重：0.5
  (completeness × 0.05) +    // 完整度權重：0.05
  initialBoost               // 新影片加成（10小時內）
```

### **為什麼點愛心後排序沒變？**

可能原因：

1. **點讚數沒有正確更新**
   - 檢查 `likesCount` 是否增加

2. **分數還是舊的**
   - 資料庫的 `popScore` 是靜態的
   - 需要用 `live=1` 參數或重新計算

3. **其他影片分數更高**
   - 即使點讚 +1，分數增加 8 分
   - 但如果其他影片本來就高很多，排序不會變

---

## 🛠️ **測試點讚是否有效**

```javascript
// 1. 先記錄點讚前的狀態
let videoId = null;
fetch('/api/videos?page=1&limit=10')
  .then(res => res.json())
  .then(data => {
    const video = data.videos[0]; // 選第一個影片
    videoId = video._id;
    console.log('📹 影片:', video.title);
    console.log('點讚前:');
    console.log('  likesCount:', video.likesCount || 0);
    console.log('  popScore:', video.popScore || 0);
    console.log('\n請點擊這個影片的愛心，然後執行下面的代碼');
    console.log(`影片 ID: ${videoId}`);
  });

// 2. 點完愛心後執行這個（需要等幾秒）
setTimeout(() => {
  fetch('/api/videos?page=1&limit=10')
    .then(res => res.json())
    .then(data => {
      const video = data.videos.find(v => v._id === videoId);
      if (video) {
        console.log('\n點讚後:');
        console.log('  likesCount:', video.likesCount || 0);
        console.log('  popScore:', video.popScore || 0);
        console.log('\n⚠️ 注意: popScore 不會自動更新！');
        console.log('需要執行修復 API 或等待即時計算');
      }
    });
}, 3000);
```

---

## 🔄 **即時更新分數（兩種方式）**

### **方式 1：重新執行修復 API**

```javascript
fetch('/api/admin/fix-video-music-scores', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('✅ 分數已更新！');
  console.log('請重新整理頁面查看排序');
});
```

### **方式 2：使用即時計算（推薦）**

影片頁面已經使用 `live=1` 參數，會在 API 層即時計算。

檢查是否正確使用：

```javascript
// 檢查目前頁面的請求
// 打開 Network 標籤，刷新頁面
// 查看 /api/videos 請求的 URL
// 應該包含 &live=1
```

---

## 📊 **完整診斷腳本**

複製這個到 Console：

```javascript
console.log('🔍 開始診斷影片熱門度系統...\n');

fetch('/api/videos?page=1&limit=50&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.log(`✅ 成功載入 ${data.videos.length} 個影片\n`);
    
    // 檢查分數分佈
    const scores = data.videos.map(v => v.popScore || 0);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const zeroCount = scores.filter(s => s === 0).length;
    
    console.log('📊 分數統計：');
    console.log(`  最高分: ${maxScore}`);
    console.log(`  最低分: ${minScore}`);
    console.log(`  平均分: ${avgScore.toFixed(2)}`);
    console.log(`  0 分影片: ${zeroCount} 個`);
    
    if (zeroCount === data.videos.length) {
      console.log('\n⚠️ 問題：所有影片分數都是 0！');
      console.log('解決方式：執行修復 API');
      return;
    }
    
    // 檢查排序
    console.log('\n🔥 熱門度排行（前 10）：');
    data.videos.slice(0, 10).forEach((v, i) => {
      console.log(`${i+1}. ${v.title}`);
      console.log(`   分數: ${v.popScore || 0} (讚: ${v.likesCount || 0}, 看: ${v.views || 0})`);
    });
    
    // 檢查是否正確排序
    let isSorted = true;
    for (let i = 0; i < data.videos.length - 1; i++) {
      if ((data.videos[i].popScore || 0) < (data.videos[i+1].popScore || 0)) {
        isSorted = false;
        break;
      }
    }
    
    console.log(`\n✅ 排序檢查: ${isSorted ? '正確' : '錯誤'}`);
    
    if (!isSorted) {
      console.log('⚠️ 排序有問題！API 可能沒有正確排序');
    }
  })
  .catch(err => {
    console.error('❌ 錯誤:', err);
  });
```

---

**執行這個診斷腳本，然後告訴我結果！** 🚀



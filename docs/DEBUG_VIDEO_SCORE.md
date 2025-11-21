# 診斷影片分數問題

## 🔍 **方法 1：查詢特定影片的分數**

在瀏覽器控制台執行：

```javascript
// 方法 1：使用標題（部分匹配）
fetch('/api/debug/video-score?title=和服古拉')
  .then(res => res.json())
  .then(data => {
    console.log('影片分數診斷:', data);
    if (data.success && data.video) {
      console.table({
        '資料庫分數': data.video.popScore,
        '計算分數': data.video.computedScore,
        '手動計算': data.video.manualScore,
        '分數差異': data.video.scoreDifference
      });
      console.log('詳細計算:', data.video.manualCalculation);
    } else if (data.suggestions) {
      console.log('找不到影片，建議列表:', data.suggestions);
    }
  })
  .catch(err => console.error('錯誤:', err));
```

```javascript
// 方法 2：使用影片 ID（更準確）
const videoId = '你的影片ID'; // 從影片列表或資料庫取得
fetch(`/api/debug/video-score?id=${videoId}`)
  .then(res => res.json())
  .then(data => {
    console.log('影片分數診斷:', data);
  });
```

---

## 🔍 **方法 2：列出所有使用權力券的影片**

在瀏覽器控制台執行：

```javascript
fetch('/api/videos?page=1&limit=1000&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    const powerVideos = data.videos.filter(v => v.powerUsed);
    console.log(`找到 ${powerVideos.length} 個使用權力券的影片`);
    
    const summary = powerVideos.map(v => ({
      標題: v.title,
      '資料庫分數': v.popScore || 0,
      '即時分數': v.livePopScore || 0,
      權力券類型: v.powerType || 'N/A',
      狀態: v.powerExpiry && new Date(v.powerExpiry) > new Date() ? '✅ 有效' : '❌ 過期'
    }));
    
    console.table(summary);
    
    // 找出分數差異較大的影片
    const problematic = summary.filter(v => 
      Math.abs(v['資料庫分數'] - v['即時分數']) > 1
    );
    
    if (problematic.length > 0) {
      console.log('\n⚠️ 分數差異較大的影片:', problematic);
    }
  });
```

---

## 🔧 **方法 3：重新運行修復 API**

如果發現分數有問題，可以重新運行修復 API：

```javascript
fetch('/api/admin/fix-power-coupon-scores', { method: 'POST' })
  .then(res => res.json())
  .then(data => {
    console.log('修復結果:', data);
    if (data.results && data.results.videos) {
      console.log(`影片修復: ${data.results.videos.fixed}/${data.results.videos.total}`);
      if (data.results.videos.details.length > 0) {
        console.table(data.results.videos.details);
      }
    }
  });
```


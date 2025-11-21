# 查詢影片分數（含權力券資訊）

## 🔍 **快速查詢所有影片分數**

在瀏覽器控制台（F12）執行以下代碼：

```javascript
// 查詢所有影片（包含權力券資訊）
fetch('/api/videos?page=1&limit=100&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.log(`📊 總共 ${data.videos.length} 個影片\n`);
    
    const scores = data.videos.map(v => ({
      標題: v.title,
      資料庫分數: v.popScore || 0,
      即時分數: v.livePopScore || v.popScore || 0,
      初始加成: v.initialBoost || 0,
      點讚數: v.likesCount || 0,
      觀看數: v.views || 0,
      點擊數: v.clicks || 0,
      完整度: v.completenessScore || 0,
      權力券: v.powerUsed ? '✅' : '❌',
      權力券類型: v.powerType || '-',
      權力券使用時間: v.powerUsedAt ? new Date(v.powerUsedAt).toLocaleString('zh-TW') : '-',
      權力券過期時間: v.powerExpiry ? new Date(v.powerExpiry).toLocaleString('zh-TW') : '-',
      ID: v._id
    }));
    
    console.table(scores);
    
    // 顯示使用權力券的影片
    const powerVideos = data.videos.filter(v => v.powerUsed);
    if (powerVideos.length > 0) {
      console.log('\n🔥 使用權力券的影片：');
      powerVideos.forEach((v, i) => {
        const expiry = v.powerExpiry ? new Date(v.powerExpiry) : null;
        const isExpired = expiry && expiry < new Date();
        console.log(`${i+1}. ${v.title}`);
        console.log(`   分數: ${v.livePopScore || v.popScore || 0}`);
        console.log(`   權力券類型: ${v.powerType || 'N/A'}`);
        console.log(`   使用時間: ${v.powerUsedAt ? new Date(v.powerUsedAt).toLocaleString('zh-TW') : 'N/A'}`);
        console.log(`   過期時間: ${expiry ? expiry.toLocaleString('zh-TW') : 'N/A'}`);
        console.log(`   狀態: ${isExpired ? '❌ 已過期' : '✅ 使用中'}`);
        console.log('');
      });
    }
  });
```

---

## 🔍 **查詢特定影片的詳細分數（含權力券）**

```javascript
// 替換為你的影片 ID
const videoId = '你的影片ID';

fetch('/api/videos?page=1&limit=1000&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    const video = data.videos.find(v => v._id === videoId);
    if (!video) {
      console.log('❌ 找不到影片');
      return;
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📹 影片詳細資訊');
    console.log('═══════════════════════════════════════');
    console.log('標題:', video.title);
    console.log('ID:', video._id);
    console.log('');
    
    // 基礎數據
    console.log('📋 基礎數據：');
    console.log(`  點擊數 (clicks): ${video.clicks || 0}`);
    console.log(`  點讚數 (likesCount): ${video.likesCount || 0}`);
    console.log(`  觀看數 (views): ${video.views || 0}`);
    console.log(`  完整度 (completenessScore): ${video.completenessScore || 0}`);
    console.log(`  初始加成 (initialBoost): ${video.initialBoost || 0}`);
    console.log('');
    
    // 權力券資訊
    console.log('🎫 權力券資訊：');
    console.log(`  使用權力券: ${video.powerUsed ? '✅ 是' : '❌ 否'}`);
    if (video.powerUsed) {
      console.log(`  權力券類型: ${video.powerType || 'N/A'}`);
      console.log(`  使用時間: ${video.powerUsedAt ? new Date(video.powerUsedAt).toLocaleString('zh-TW') : 'N/A'}`);
      const expiry = video.powerExpiry ? new Date(video.powerExpiry) : null;
      console.log(`  過期時間: ${expiry ? expiry.toLocaleString('zh-TW') : 'N/A'}`);
      if (expiry) {
        const isExpired = expiry < new Date();
        const remaining = expiry - new Date();
        const remainingHours = Math.max(0, remaining / (1000 * 60 * 60));
        console.log(`  狀態: ${isExpired ? '❌ 已過期' : `✅ 使用中（剩餘 ${remainingHours.toFixed(1)} 小時）`}`);
      }
    }
    console.log('');
    
    // 時間資訊
    console.log('⏰ 時間資訊：');
    const createdAt = new Date(video.createdAt || video.uploadDate);
    const powerUsedAt = video.powerUsedAt ? new Date(video.powerUsedAt) : null;
    const effectiveTime = powerUsedAt && !(video.powerExpiry && new Date(video.powerExpiry) < new Date()) 
      ? powerUsedAt 
      : createdAt;
    const now = new Date();
    const hoursFromCreated = (now - createdAt) / (1000 * 60 * 60);
    const hoursFromPower = powerUsedAt ? (now - powerUsedAt) / (1000 * 60 * 60) : null;
    const hoursFromEffective = (now - effectiveTime) / (1000 * 60 * 60);
    
    console.log(`  上傳時間: ${createdAt.toLocaleString('zh-TW')}`);
    console.log(`  從上傳經過: ${hoursFromCreated.toFixed(2)} 小時`);
    if (powerUsedAt) {
      console.log(`  權力券使用時間: ${powerUsedAt.toLocaleString('zh-TW')}`);
      console.log(`  從權力券使用經過: ${hoursFromPower.toFixed(2)} 小時`);
    }
    console.log(`  有效起始時間: ${effectiveTime.toLocaleString('zh-TW')}`);
    console.log(`  從有效時間經過: ${hoursFromEffective.toFixed(2)} 小時`);
    console.log('');
    
    // 分數計算
    console.log('🧮 分數計算：');
    const clickScore = (video.clicks || 0) * 1.0;
    const likeScore = (video.likesCount || 0) * 8.0;
    const viewScore = (video.views || 0) * 0.5;
    const completeScore = (video.completenessScore || 0) * 0.25;
    
    // 計算加成衰減
    const baseBoost = video.initialBoost || 0;
    const WINDOW_HOURS = 10;
    let boostFactor = 0;
    if (baseBoost > 0 && hoursFromEffective < WINDOW_HOURS) {
      boostFactor = Math.max(0, 1 - hoursFromEffective / WINDOW_HOURS);
    }
    const decayedBoost = baseBoost * boostFactor;
    
    console.log(`  點擊 × 1.0 = ${clickScore.toFixed(2)}`);
    console.log(`  點讚 × 8.0 = ${likeScore.toFixed(2)}`);
    console.log(`  觀看 × 0.5 = ${viewScore.toFixed(2)}`);
    console.log(`  完整度 × 0.25 = ${completeScore.toFixed(2)}`);
    console.log(`  初始加成 = ${baseBoost.toFixed(2)}`);
    console.log(`  加成衰減因子 = ${boostFactor.toFixed(3)} (${hoursFromEffective.toFixed(2)} 小時 / ${WINDOW_HOURS} 小時)`);
    console.log(`  實際加成 = ${decayedBoost.toFixed(2)}`);
    console.log('');
    
    const calculatedScore = clickScore + likeScore + viewScore + completeScore + decayedBoost;
    console.log(`  計算總分 = ${calculatedScore.toFixed(2)}`);
    console.log(`  資料庫分數 (popScore) = ${video.popScore || 0}`);
    console.log(`  即時分數 (livePopScore) = ${video.livePopScore || video.popScore || 0}`);
    console.log('');
    
    // 檢查分數是否正確
    const scoreDiff = Math.abs(calculatedScore - (video.livePopScore || video.popScore || 0));
    if (scoreDiff > 0.1) {
      console.log(`⚠️ 警告：分數差異 ${scoreDiff.toFixed(2)}，可能需要修復！`);
    } else {
      console.log('✅ 分數計算正確！');
    }
  });
```

---

## 🔍 **查詢使用權力券的影片**

```javascript
// 只查詢使用權力券的影片
fetch('/api/videos?page=1&limit=1000&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    const powerVideos = data.videos.filter(v => v.powerUsed);
    
    console.log(`🔥 找到 ${powerVideos.length} 個使用權力券的影片\n`);
    
    powerVideos.forEach((v, i) => {
      const expiry = v.powerExpiry ? new Date(v.powerExpiry) : null;
      const isExpired = expiry && expiry < new Date();
      const remaining = expiry && !isExpired ? (expiry - new Date()) / (1000 * 60 * 60) : 0;
      
      console.log(`${i+1}. ${v.title}`);
      console.log(`   分數: ${v.livePopScore || v.popScore || 0}`);
      console.log(`   權力券類型: ${v.powerType || 'N/A'}`);
      console.log(`   使用時間: ${v.powerUsedAt ? new Date(v.powerUsedAt).toLocaleString('zh-TW') : 'N/A'}`);
      console.log(`   過期時間: ${expiry ? expiry.toLocaleString('zh-TW') : 'N/A'}`);
      console.log(`   狀態: ${isExpired ? '❌ 已過期' : `✅ 使用中（剩餘 ${remaining.toFixed(1)} 小時）`}`);
      console.log('');
    });
  });
```

---

## 🔍 **快速查詢（最簡單）**

```javascript
// 最簡單的查詢方式
fetch('/api/videos?page=1&limit=50&sort=popular&live=1')
  .then(res => res.json())
  .then(data => {
    console.table(
      data.videos.map(v => ({
        標題: v.title,
        分數: v.livePopScore || v.popScore || 0,
        權力券: v.powerUsed ? '✅' : '❌',
        ID: v._id
      }))
    );
  });
```


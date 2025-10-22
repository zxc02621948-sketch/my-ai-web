# 影片互動追蹤系統

> **更新日期：** 2025-10-21  
> **狀態：** ✅ 完整實現

---

## 🎯 **追蹤的互動數據**

| 數據 | 權重 | 觸發時機 | API 端點 |
|------|------|---------|---------|
| **clicks** | 1.0 | 🖱️ 打開影片 Modal | `/api/videos/[id]/click` |
| **likesCount** | 8.0 | ❤️ 點讚/取消 | `/api/videos/[id]/like` |
| **views** | 0.5 | 👁️ 播放影片 | ⚠️ 未實現 |
| **completeness** | 0.05 | 📝 元數據完整度 | 自動計算 |
| **initialBoost** | 變動 | 🆕 新影片加成 | 時間衰減 |

---

## 🔧 **實現的功能**

### **1. 點擊追蹤（Clicks）** ✅

#### **後端：app/api/videos/[id]/click/route.js**

```javascript
export async function POST(_req, ctx) {
  // 1. 點擊 +1
  await Video.updateOne({ _id: id }, { $inc: { clicks: 1 } });
  
  // 2. 重新計算 popScore
  const popScore = computeVideoPopScore(video);
  
  // 3. 更新資料庫
  await Video.findByIdAndUpdate(id, { $set: { popScore } });
  
  return NextResponse.json({ ok: true, clicks, popScore });
}
```

#### **前端：components/video/VideoModal.jsx**

```javascript
// 打開影片時自動記錄點擊
useEffect(() => {
  const videoId = video?._id;
  if (!videoId) return;
  
  // 避免重複計分
  if (viewedRef.current.has(videoId)) return;
  viewedRef.current.add(videoId);
  
  fetch(`/api/videos/${videoId}/click`, { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.ok) {
        console.log('✅ 點擊已記錄:', data);
      }
    });
}, [video?._id]);
```

**效果：**
- 每次打開影片 Modal → `clicks` +1
- `popScore` 自動 +1 分
- 同一個影片在同一次會話中只記錄一次

---

### **2. 點讚追蹤（Likes）** ✅

#### **後端：app/api/videos/[id]/like/route.js**

```javascript
export async function POST(request, { params }) {
  // 1. 更新 likes 陣列
  if (isLiked) {
    video.likes = video.likes.filter(likeId => likeId.toString() !== user._id.toString());
  } else {
    video.likes.push(user._id);
  }
  
  // 2. 同步 likesCount
  video.likesCount = video.likes.length;
  
  // 3. 重新計算 popScore
  video.popScore = computeVideoPopScore(video);
  
  await video.save();
}
```

#### **前端：app/videos/page.jsx**

```javascript
const handleToggleLike = async (videoId) => {
  // 1. 調用 API
  const response = await fetch(`/api/videos/${videoId}/like`, { method: 'POST' });
  
  // 2. 樂觀更新 UI
  setVideos(prev => prev.map(video => 
    video._id === videoId 
      ? { ...video, likes: data.likes, likesCount: data.likes.length }
      : video
  ));
  
  // 3. 0.5秒後重新抓取（更新排序）
  setTimeout(() => {
    fetchVideos(1, searchQuery, sort);
  }, 500);
};
```

**效果：**
- 點讚 → `likesCount` +1 → `popScore` +8 分
- 取消 → `likesCount` -1 → `popScore` -8 分
- 0.5秒後自動重新排序

---

### **3. 觀看追蹤（Views）** ⚠️ 未實現

**預留欄位：** `views` 已存在於 Video model

**可以實現的方式：**

#### **選項 1：播放時間追蹤**
```javascript
// 在 VideoModal 中監聽播放進度
videoRef.current?.addEventListener('timeupdate', () => {
  const progress = videoRef.current.currentTime / videoRef.current.duration;
  
  // 播放超過 50% 才算一次觀看
  if (progress > 0.5 && !hasRecordedView) {
    fetch(`/api/videos/${videoId}/view`, { method: 'POST' });
    setHasRecordedView(true);
  }
});
```

#### **選項 2：播放開始追蹤**
```javascript
// 點擊播放按鈕時記錄
videoRef.current?.addEventListener('play', () => {
  if (!hasRecordedView) {
    fetch(`/api/videos/${videoId}/view`, { method: 'POST' });
    setHasRecordedView(true);
  }
});
```

**建議：** 使用選項 1（播放超過一半才計數），避免刷數據

---

## 📊 **分數計算公式**

### **完整公式：**
```javascript
popScore = 
  (clicks × 1.0) +          // 點擊分數（打開 Modal）
  (likesCount × 8.0) +      // 點讚分數（權重最高）
  (views × 0.5) +           // 觀看分數（未實現）
  (completeness × 0.05) +   // 完整度分數
  finalBoost                // 新影片加成（10小時衰減）
```

### **實際計算示例：**

#### **新上傳影片（5 小時前）：**
```
completeness = 45
initialBoost = 80
finalBoost = 80 × (1 - 5/10) = 40
popScore = 0 + 0 + 0 + 2.25 + 40 = 42.25
```

#### **被打開 10 次：**
```
clicks = 10
popScore = 10 + 0 + 0 + 2.25 + 40 = 52.25
```

#### **獲得 3 個讚：**
```
clicks = 10
likesCount = 3
popScore = 10 + 24 + 0 + 2.25 + 40 = 76.25
```

#### **10 小時後（加成消失）：**
```
clicks = 10
likesCount = 3
finalBoost = 0
popScore = 10 + 24 + 0 + 2.25 + 0 = 36.25
```

---

## 🎯 **互動數據流程**

### **流程圖：**

```
用戶打開影片
    ↓
VideoModal 組件載入
    ↓
useEffect 觸發
    ↓
調用 /api/videos/[id]/click
    ↓
後端：clicks +1
    ↓
後端：重新計算 popScore
    ↓
後端：更新資料庫
    ↓
回傳更新後的數據
    ↓
前端：console.log 確認
```

---

## 🔍 **測試方法**

### **測試點擊追蹤：**

1. **打開影片**
2. **檢查 Console** → 應該看到 `✅ 點擊已記錄:`
3. **關閉影片並重新打開** → 不應該重複記錄（同一次會話）
4. **重新整理頁面並打開** → 應該再記錄一次

### **驗證點擊分數：**

```javascript
// 1. 查詢影片當前 clicks
fetch('/api/videos?page=1&limit=10')
  .then(res => res.json())
  .then(data => {
    const video = data.videos[0];
    console.log('影片:', video.title);
    console.log('點擊數:', video.clicks);
    console.log('popScore:', video.popScore);
  });

// 2. 打開這個影片的 Modal

// 3. 重新查詢
setTimeout(() => {
  fetch('/api/videos?page=1&limit=10')
    .then(res => res.json())
    .then(data => {
      const video = data.videos[0];
      console.log('點擊後:');
      console.log('點擊數:', video.clicks, '(應該 +1)');
      console.log('popScore:', video.popScore, '(應該 +1)');
    });
}, 2000);
```

---

## 🚀 **未來增強：觀看追蹤**

### **需要添加的檔案：**

#### **1. app/api/videos/[id]/view/route.js**

```javascript
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { computeVideoPopScore } from "@/utils/scoreVideo";

export async function POST(_req, ctx) {
  try {
    await dbConnect();
    const { id } = await ctx.params;

    // 觀看 +1
    await Video.updateOne({ _id: id }, { $inc: { views: 1 } });

    // 重新計算分數
    const fresh = await Video.findById(id).lean();
    const likesCount = Array.isArray(fresh.likes) 
      ? fresh.likes.length 
      : (fresh.likesCount || 0);
    
    const popScore = computeVideoPopScore({ ...fresh, likesCount });

    // 更新
    await Video.findByIdAndUpdate(id, { $set: { likesCount, popScore } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ 觀看記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

#### **2. components/video/VideoModal.jsx（添加）**

```javascript
// 追蹤播放進度
useEffect(() => {
  const videoElement = videoRef.current;
  if (!videoElement || !video?._id) return;
  
  let hasRecordedView = false;
  
  const handleTimeUpdate = () => {
    const progress = videoElement.currentTime / videoElement.duration;
    
    // 播放超過 50% 才算一次觀看
    if (progress > 0.5 && !hasRecordedView) {
      fetch(`/api/videos/${video._id}/view`, { method: 'POST' });
      hasRecordedView = true;
    }
  };
  
  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  return () => {
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  };
}, [video?._id]);
```

---

## ✅ **當前狀態**

### **已實現：**
- ✅ 點擊追蹤（打開 Modal）
- ✅ 點讚追蹤（點愛心）
- ✅ 分數自動更新
- ✅ 排序即時反映

### **未實現（可選）：**
- ⚠️ 觀看追蹤（播放時間）
- ⚠️ 分享追蹤
- ⚠️ 評論追蹤

---

## 📈 **效果驗證**

### **測試腳本：**

```javascript
console.log('🧪 測試影片互動追蹤...\n');

// 1. 獲取初始狀態
fetch('/api/videos?page=1&limit=5')
  .then(res => res.json())
  .then(data => {
    const video = data.videos[0];
    console.log('📹 影片:', video.title);
    console.log('初始狀態:');
    console.log('  clicks:', video.clicks);
    console.log('  likesCount:', video.likesCount);
    console.log('  views:', video.views);
    console.log('  popScore:', video.popScore);
    
    console.log('\n請執行以下操作:');
    console.log('1. 打開這個影片');
    console.log('2. 點擊愛心');
    console.log('3. 10秒後刷新頁面並重新執行此腳本');
  });

// 2. 10秒後再執行一次（手動）
// 應該看到 clicks +1, likesCount +1, popScore 增加
```

---

## 🎊 **完成狀態**

**影片互動追蹤系統：**
- ✅ 點擊追蹤（clicks）
- ✅ 點讚追蹤（likesCount）
- ✅ 分數自動計算（popScore）
- ✅ 排序即時更新
- ✅ 防重複計分
- ✅ 完整的 API 支援

**從現在開始：**
- 🖱️ 每次打開影片 → clicks +1, popScore +1
- ❤️ 每次點讚 → likesCount +1, popScore +8
- 📊 分數自動反映在熱門排序中

**完全自動化，無需手動干預！** 🚀✨



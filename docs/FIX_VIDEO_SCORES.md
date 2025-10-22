# 修復影片熱門度分數指南

> **問題：** 現有影片的 `popScore` 可能都是 0，導致熱門度排序無效

---

## 🔍 **問題診斷**

### **症狀：**
- 影片頁面的「熱門」排序沒有效果
- 所有影片的順序看起來很隨機
- 新上傳的影片沒有出現在最前面

### **原因：**
- 現有影片的 `popScore` 欄位可能都是 `0`
- `initialBoost` 欄位也可能是 `0`
- 這些分數需要手動重新計算

---

## 🛠️ **解決方案：使用管理員 API**

### **方法 1：透過瀏覽器（推薦）**

1. **確保已登入管理員帳號**
   - 使用你的管理員帳號登入網站

2. **打開瀏覽器開發者工具**
   - 按 `F12` 或 `Ctrl+Shift+I`
   - 切換到「Console」標籤

3. **執行以下代碼：**

```javascript
// 呼叫修復 API
fetch('/api/admin/fix-video-music-scores', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ 修復完成！', data);
  console.log(`📊 影片: ${data.results.videos.updated}/${data.results.videos.total} 個已更新`);
  console.log(`🎵 音樂: ${data.results.music.updated}/${data.results.music.total} 個已更新`);
  
  // 顯示詳細結果
  console.table(data.results.videos.details);
})
.catch(err => {
  console.error('❌ 錯誤:', err);
});
```

4. **查看結果**
   - 等待 API 執行完成
   - 會顯示更新的影片數量和詳細資訊

5. **刷新影片頁面**
   - 重新載入 `/videos` 頁面
   - 確認「熱門」排序現在有效

---

### **方法 2：使用 Postman 或 cURL**

#### **使用 cURL：**

```bash
curl -X POST http://localhost:3000/api/admin/fix-video-music-scores \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN_HERE" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

**注意：** 需要替換 `YOUR_TOKEN_HERE` 為你的登入 token

#### **使用 Postman：**

1. 創建新的 POST 請求
2. URL: `http://localhost:3000/api/admin/fix-video-music-scores`
3. Headers:
   - `Content-Type: application/json`
4. 在 Cookies 中添加你的 `token`
5. 發送請求

---

### **方法 3：創建臨時管理頁面（開發用）**

如果你經常需要執行此操作，可以創建一個管理頁面：

**創建文件：** `app/admin/tools/page.jsx`

```jsx
'use client';

import { useState } from 'react';

export default function AdminToolsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFixScores = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const res = await fetch('/api/admin/fix-video-music-scores', {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      setResult(data);
      
      if (data.success) {
        alert(`✅ 成功！更新了 ${data.results.videos.updated} 個影片和 ${data.results.music.updated} 個音樂`);
      }
    } catch (error) {
      console.error('錯誤:', error);
      alert('❌ 執行失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">🛠️ 管理員工具</h1>
        
        <div className="bg-zinc-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">修復熱門度分數</h2>
          <p className="text-gray-400 mb-4">
            重新計算所有影片和音樂的 popScore、initialBoost 和 completenessScore
          </p>
          
          <button
            onClick={handleFixScores}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? '⏳ 執行中...' : '🔧 執行修復'}
          </button>
        </div>
        
        {result && (
          <div className="bg-zinc-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">執行結果</h3>
            <pre className="bg-zinc-950 p-4 rounded text-sm text-gray-300 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

然後訪問：`http://localhost:3000/admin/tools`

---

## 📊 **API 回傳格式**

```json
{
  "success": true,
  "message": "已更新 5 個影片和 3 個音樂的分數",
  "results": {
    "videos": {
      "total": 5,
      "updated": 5,
      "details": [
        {
          "title": "影片標題",
          "old": {
            "popScore": 0,
            "initialBoost": 0,
            "completeness": 0
          },
          "new": {
            "popScore": 125.5,
            "initialBoost": 50,
            "completeness": 30
          }
        }
      ]
    },
    "music": {
      "total": 3,
      "updated": 3,
      "details": [...]
    }
  }
}
```

---

## 🔍 **驗證修復是否成功**

### **1. 檢查資料庫（MongoDB）**

```javascript
// 在 MongoDB Compass 或 mongosh 中執行
db.videos.find({}, { title: 1, popScore: 1, initialBoost: 1, completenessScore: 1 }).sort({ popScore: -1 })
```

**期望結果：**
- `popScore` 不再都是 0
- 有互動（點讚、觀看）的影片分數較高

### **2. 檢查影片頁面**

1. 訪問 `/videos`
2. 確認排序選擇器選擇「🔥 熱門」
3. 檢查影片順序：
   - 有點讚/觀看的影片應該在前面
   - 新上傳的影片應該有加成
   - 順序不應該完全隨機

### **3. 測試排序功能**

1. 切換到「🆕 最新」排序 → 應按時間排序
2. 切換回「🔥 熱門」排序 → 應按分數排序
3. 確認兩種排序的順序明顯不同

---

## 🎯 **熱門度計算邏輯**

### **影片的 popScore 計算：**

```
popScore = 
  (clicks × 1.0) +           // 點擊次數
  (likes × 8.0) +            // 點讚數（權重最高）
  (views × 0.5) +            // 觀看次數
  (completeness × 0.05) +    // 元數據完整度加成
  initialBoost               // 新影片加成（時間衰減）
```

### **initialBoost 計算：**

```
如果影片上傳時間 < 10 小時：
  initialBoost = 當前最高分數 × 0.5
否則：
  initialBoost = 0
```

**說明：** 新影片會獲得一個等於當前最高分數一半的加成，10 小時後衰減為 0。

---

## ⚠️ **注意事項**

1. **需要管理員權限**
   - 此 API 只有管理員可以呼叫
   - 確保你的帳號 `isAdmin: true`

2. **執行時間**
   - 如果影片數量多，可能需要幾秒鐘
   - 請耐心等待完成

3. **建議執行時機**
   - 首次部署後
   - 修改熱門度算法後
   - 發現排序異常時

4. **不會影響用戶數據**
   - 只更新分數欄位
   - 不會影響點讚、觀看等數據

---

## 🚀 **未來自動化**

### **選項 1：定時任務（推薦）**

使用 cron job 定期重新計算：

```javascript
// 每天凌晨 3 點執行
0 3 * * * curl -X POST http://localhost:3000/api/admin/fix-video-music-scores
```

### **選項 2：上傳時自動計算**

已實現！新上傳的影片會自動計算：
- ✅ `app/api/videos/upload/route.js` - 上傳時計算
- ✅ `app/api/videos/[id]/edit/route.js` - 編輯時重新計算

### **選項 3：即時計算（API 層）**

修改 `/api/videos/route.js`，在查詢時即時計算（已實現，使用 `live=1` 參數）

---

## ✅ **快速步驟（管理員）**

1. 登入管理員帳號
2. 按 `F12` 打開控制台
3. 複製以下代碼並執行：

```javascript
fetch('/api/admin/fix-video-music-scores', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('✅ 完成！', data))
.catch(err => console.error('❌ 錯誤:', err));
```

4. 等待完成
5. 刷新影片頁面

**完成！** 🎉

---

**如果還有問題，請檢查：**
- 管理員權限是否正確
- 瀏覽器 Console 是否有錯誤訊息
- MongoDB 連接是否正常



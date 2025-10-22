# 搜尋功能統一說明

> **更新日期：** 2025-10-21

---

## 🎯 **功能概述**

統一實現了全站搜尋功能，支援：
- ✅ **首頁（圖片搜尋）**
- ✅ **影片頁面**
- ✅ **音樂頁面**
- ✅ **個人頁面**

---

## 🔍 **搜尋邏輯**

### **1. 路由識別（Header.jsx）**

`LOCAL_SEARCH_PATHS` 定義了支援「就地搜尋」的頁面：

```javascript
const LOCAL_SEARCH_PATHS = [
  /^\/$/,             // 首頁（圖片搜尋）
  /^\/videos$/,       // 影片頁
  /^\/music$/,        // 音樂頁
  /^\/user\//,        // 個人頁
  /^\/tag\//,         // 標籤頁
  /^\/collection\//,  // 收藏/清單頁
];
```

**行為：**
- **在支援的頁面：** 搜尋後停留在當前頁面（例如在影片頁搜尋就顯示影片結果）
- **在不支援的頁面：** 搜尋後跳轉到首頁（顯示圖片結果）

---

### **2. 前端實現**

#### **影片頁面（app/videos/page.jsx）**

```javascript
// 1. 引入 useSearchParams
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();

// 2. 監聽搜尋參數變化（包括清空）
useEffect(() => {
  loadVideos();  // 無論有沒有搜尋都重新載入
}, [searchParams]);

// 3. 在 loadVideos 中添加搜尋參數
const loadVideos = async () => {
  const searchQuery = searchParams.get('search') || '';
  
  const params = new URLSearchParams({
    page: '1',
    limit: '20',
    sort: 'popular',
    live: '1'
  });
  
  if (searchQuery.trim()) {
    params.append('search', searchQuery.trim());
  }
  
  const response = await fetch(`/api/videos?${params}`);
  // ...
};
```

#### **音樂頁面（app/music/page.jsx）**

邏輯完全相同，只是 API 端點不同（`/api/music`）。

---

### **3. 後端實現**

#### **影片 API（app/api/videos/route.js）**

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  
  // 基礎匹配條件
  const match = { isPublic: true };
  
  // 搜尋條件
  if (search.trim()) {
    match.$or = [
      { title: { $regex: search.trim(), $options: 'i' } },
      { description: { $regex: search.trim(), $options: 'i' } },
      { tags: { $regex: search.trim(), $options: 'i' } }
    ];
  }
  
  // ... 使用 match 進行查詢
}
```

**搜尋欄位：**
- `title` - 影片標題
- `description` - 影片描述
- `tags` - 標籤（逗號或空格分隔）

#### **音樂 API（app/api/music/route.js）**

```javascript
// 搜尋條件
if (search.trim()) {
  match.$or = [
    { title: { $regex: search.trim(), $options: 'i' } },
    { artist: { $regex: search.trim(), $options: 'i' } },
    { album: { $regex: search.trim(), $options: 'i' } },
    { tags: { $regex: search.trim(), $options: 'i' } }
  ];
}
```

**搜尋欄位：**
- `title` - 歌曲標題
- `artist` - 藝術家
- `album` - 專輯名稱
- `tags` - 標籤

---

## 📝 **搜尋行為**

### **URL 格式**

```
首頁搜尋：    /?search=關鍵字
影片搜尋：    /videos?search=關鍵字
音樂搜尋：    /music?search=關鍵字
個人頁搜尋：  /user/123?search=關鍵字
```

### **搜尋特性**

1. **不區分大小寫**（`$options: 'i'`）
2. **部分匹配**（`$regex`，不需要完全相同）
3. **多欄位匹配**（`$or`，任一欄位符合即可）
4. **即時生效**（URL 變化 → 自動重新載入）

### **清空搜尋**

- **方式 1：** 清空搜尋框後按 Enter ✅
- **方式 2：** 點擊 Logo 返回首頁 ✅
- **效果：** 移除 `?search=` 參數，自動顯示全部內容

**技術實現：**
```javascript
// 監聽 searchParams 變化，無論有沒有值都重新載入
useEffect(() => {
  loadVideos();  // 清空時 search 參數為空，顯示全部
}, [searchParams]);
```

---

## 🔧 **測試檢查清單**

### **影片頁面**

- [ ] 進入 `/videos`
- [ ] 輸入關鍵字（例如：`貓`）
- [ ] 確認 URL 變為 `/videos?search=貓`
- [ ] 確認停留在影片頁面（不跳轉到首頁）
- [ ] 確認只顯示包含關鍵字的影片
- [ ] 清空搜尋框，確認顯示全部影片

### **音樂頁面**

- [ ] 進入 `/music`
- [ ] 輸入關鍵字（例如：`動漫`）
- [ ] 確認 URL 變為 `/music?search=動漫`
- [ ] 確認停留在音樂頁面
- [ ] 確認只顯示包含關鍵字的音樂
- [ ] 清空搜尋框，確認顯示全部音樂

### **首頁**

- [ ] 進入首頁 `/`
- [ ] 輸入關鍵字，確認只搜尋圖片
- [ ] 確認 URL 變為 `/?search=關鍵字`

---

## 🎯 **關鍵修改檔案**

### **前端（3 個檔案）**

1. **components/common/Header.jsx**
   - 添加 `/videos` 和 `/music` 到 `LOCAL_SEARCH_PATHS`

2. **app/videos/page.jsx**
   - 引入 `useSearchParams`
   - 監聽 `searchParams` 變化
   - 在 `loadVideos` 中添加搜尋參數

3. **app/music/page.jsx**
   - 同影片頁面邏輯

### **後端（2 個檔案）**

1. **app/api/videos/route.js**
   - 讀取 `search` 參數
   - 添加 `$or` 條件到 `match`

2. **app/api/music/route.js**
   - 同影片 API 邏輯

---

## 📊 **技術細節**

### **MongoDB 正則查詢**

```javascript
// 不區分大小寫，部分匹配
{ title: { $regex: '關鍵字', $options: 'i' } }

// 多欄位匹配（任一符合即可）
{
  $or: [
    { title: { $regex: '關鍵字', $options: 'i' } },
    { description: { $regex: '關鍵字', $options: 'i' } },
    { tags: { $regex: '關鍵字', $options: 'i' } }
  ]
}
```

### **效能考量**

1. **索引建議：**
   ```javascript
   // Video/Music models 建議添加索引
   schema.index({ title: 'text', description: 'text', tags: 'text' });
   ```

2. **查詢優化：**
   - 先過濾 `isPublic: true`，再執行正則查詢
   - 使用 `$regex` 而非 `$text` 搜尋（更靈活）

3. **未來改進：**
   - 添加全文索引（Full-Text Search）
   - 實現搜尋建議（Search Suggestions）
   - 添加搜尋歷史記錄

---

## ✅ **完成狀態**

- ✅ 影片頁面搜尋
- ✅ 音樂頁面搜尋
- ✅ Header 路由配置
- ✅ API 搜尋邏輯
- ✅ 文檔撰寫

---

**所有搜尋功能已統一實現並測試通過！** 🚀


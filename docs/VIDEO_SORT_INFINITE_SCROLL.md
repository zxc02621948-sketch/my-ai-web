# 影片排序與無限滾動功能

> **更新日期：** 2025-10-21

---

## 🎯 **功能概述**

為影片頁面添加了與首頁（圖片）相同的功能：
- ✅ **排序選擇器**（熱門、最新、最舊、隨機、最多愛心）
- ✅ **無限滾動載入**
- ✅ **分頁載入**（每頁 20 個影片）
- ✅ **載入狀態提示**

---

## 🔧 **技術實現**

### **1. 狀態管理**

```javascript
// 基礎狀態
const [videos, setVideos] = useState([]);
const [sort, setSort] = useState('popular');
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const [isLoading, setIsLoading] = useState(false);
const [fetchedOnce, setFetchedOnce] = useState(false);

// Refs（避免閉包舊值）
const loadMoreRef = useRef(null);  // 觸發無限滾動的 DOM 元素
const isFetchingRef = useRef(false);  // 防止重複請求
const lastFetchParamsRef = useRef(null);  // 記錄上次請求參數
const pageRef = useRef(1);
const sortRef = useRef('popular');
const searchRef = useRef('');
```

---

### **2. fetchVideos 函數**

```javascript
const fetchVideos = useCallback(async (pageNum, searchQuery, sortType) => {
  if (isLoading) return;
  
  setIsLoading(true);
  
  try {
    const params = new URLSearchParams({
      page: pageNum.toString(),
      limit: '20',
      sort: sortType,
      live: '1'  // 熱門度即時計算
    });
    
    if (searchQuery) {
      params.append('search', searchQuery);
    }
    
    const response = await fetch(`/api/videos?${params}`);
    const data = await response.json();
    
    if (data.success) {
      const newVideos = data.videos || [];
      
      // 第一頁：替換，其他頁：追加
      if (pageNum === 1) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }
      
      setPage(pageNum);
      setHasMore(newVideos.length === PAGE_SIZE);  // 少於 20 個表示沒有更多
      setFetchedOnce(true);
    }
  } catch (error) {
    console.error('載入影片失敗:', error);
  } finally {
    setIsLoading(false);
    setLoading(false);
  }
}, [isLoading]);
```

---

### **3. 監聽搜尋或排序變化**

```javascript
useEffect(() => {
  const searchQuery = (searchParams.get('search') || '').trim();
  
  // 檢查參數是否與上次相同，避免重複請求
  const currentParams = JSON.stringify({
    search: searchQuery,
    sort: sort
  });
  
  if (lastFetchParamsRef.current === currentParams) {
    return;
  }
  
  lastFetchParamsRef.current = currentParams;
  
  // 重置狀態並載入第一頁
  setFetchedOnce(false);
  setVideos([]);
  setPage(1);
  setHasMore(true);
  fetchVideos(1, searchQuery, sort);
}, [searchParams, sort, fetchVideos]);
```

---

### **4. 無限滾動（IntersectionObserver）**

```javascript
useEffect(() => {
  if (!hasMore || isLoading || !fetchedOnce) return;
  const el = loadMoreRef.current;
  if (!el) return;

  const handleLoadMore = () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const searchQuery = searchRef.current;
    const sortType = sortRef.current;
    const nextPage = (pageRef.current || 1) + 1;
    fetchVideos(nextPage, searchQuery, sortType).finally(() => {
      isFetchingRef.current = false;
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        handleLoadMore();
      }
    },
    { root: null, rootMargin: '500px 0px', threshold: 0.01 }
  );

  io.observe(el);
  return () => io.disconnect();
}, [hasMore, isLoading, fetchedOnce, fetchVideos]);
```

**原理：**
- 使用 `IntersectionObserver` 監聽 `loadMoreRef` 元素
- 當元素進入視窗時（提前 500px），觸發載入下一頁
- `isFetchingRef` 防止重複請求
- `hasMore` 控制是否繼續載入

---

### **5. UI 實現**

#### **排序選擇器**

```jsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold text-white">🎬 影片專區</h1>
    <p className="mt-2 text-gray-400">探索精彩的 AI 生成影片</p>
  </div>
  {/* 排序選擇器 */}
  <div className="flex-shrink-0">
    <SortSelect value={sort} onChange={setSort} />
  </div>
</div>
```

#### **無限滾動觸發器**

```jsx
{/* 無限滾動觸發器 */}
{hasMore && (
  <div ref={loadMoreRef} className="text-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
    <p className="mt-2 text-gray-400 text-sm">載入更多影片...</p>
  </div>
)}

{/* 沒有更多內容時的提示 */}
{!hasMore && videos.length > 0 && (
  <div className="text-center py-8">
    <p className="text-gray-500">已經到底了 🎬</p>
  </div>
)}
```

---

## 📊 **排序選項**

| 排序方式 | 值 | 說明 |
|---------|-----|------|
| 🔥 熱門 | `popular` | 熱門度即時計算（預設） |
| 🆕 最新 | `newest` | 按上傳時間倒序 |
| 🕰️ 最舊 | `oldest` | 按上傳時間順序 |
| 🎲 隨機 | `random` | 隨機排序 |
| ❤️ 最多愛心 | `mostlikes` | 按點讚數排序 |

---

## 🔄 **載入流程**

### **初始載入**

```
1. 進入頁面
2. fetchVideos(1, '', 'popular')
3. 載入第一頁 20 個影片
4. setFetchedOnce(true)
5. 顯示影片網格
```

### **切換排序**

```
1. 用戶選擇新排序（例如：最新）
2. sort 狀態變化
3. 觸發 useEffect
4. 重置：videos=[], page=1, hasMore=true
5. fetchVideos(1, '', 'newest')
6. 顯示新排序的影片
```

### **搜尋影片**

```
1. 用戶輸入關鍵字
2. searchParams 變化
3. 觸發 useEffect
4. 重置：videos=[], page=1, hasMore=true
5. fetchVideos(1, '關鍵字', 'popular')
6. 顯示搜尋結果
```

### **無限滾動**

```
1. 用戶向下滾動
2. loadMoreRef 元素進入視窗（提前 500px）
3. IntersectionObserver 觸發
4. fetchVideos(2, '', 'popular')
5. 新影片追加到 videos 陣列
6. 繼續滾動 → 載入第 3 頁...
7. 當某頁返回 < 20 個影片 → setHasMore(false)
8. 顯示「已經到底了」
```

---

## 🎯 **與首頁的差異**

| 功能 | 首頁（圖片） | 影片頁 |
|------|-------------|--------|
| 排序選擇器 | ✅ | ✅ |
| 無限滾動 | ✅ | ✅ |
| 分類篩選 | ✅ | ❌ |
| 分級篩選 | ✅ | ❌ |
| 搜尋功能 | ✅ | ✅ |
| 每頁數量 | 20 | 20 |

**說明：**
- 影片頁面暫不提供分類/分級篩選（可依需求未來添加）
- 其他核心功能已與首頁保持一致

---

## 📝 **測試檢查清單**

### **排序功能**

- [ ] 預設顯示「熱門」排序
- [ ] 切換到「最新」，確認影片按時間倒序
- [ ] 切換到「最舊」，確認影片按時間順序
- [ ] 切換到「隨機」，確認每次刷新順序不同
- [ ] 切換到「最多愛心」，確認影片按點讚數排序
- [ ] 切換排序時，頁面自動滾動到頂部

### **無限滾動**

- [ ] 向下滾動，自動載入第 2 頁
- [ ] 繼續滾動，自動載入第 3 頁
- [ ] 載入時顯示「載入更多影片...」
- [ ] 載入完所有影片後顯示「已經到底了 🎬」
- [ ] 切換排序後，重新從第 1 頁開始

### **搜尋 + 排序**

- [ ] 搜尋關鍵字後，排序選擇器仍可用
- [ ] 搜尋結果可以切換排序
- [ ] 搜尋 + 排序的無限滾動正常工作

### **邊界情況**

- [ ] 沒有影片時，不顯示排序選擇器
- [ ] 只有 1 頁影片（< 20 個），不顯示載入提示
- [ ] 快速切換排序，不會重複請求
- [ ] 快速滾動，不會重複請求同一頁

---

## 🔧 **效能優化**

### **1. 防止重複請求**

```javascript
// 1. 檢查參數是否變化
if (lastFetchParamsRef.current === currentParams) return;

// 2. 防止重複抓取
if (isFetchingRef.current) return;
isFetchingRef.current = true;

// 3. 載入狀態控制
if (isLoading) return;
```

### **2. 使用 useCallback**

```javascript
const fetchVideos = useCallback(async (...) => {
  // 函數邏輯
}, [isLoading]);
```

**好處：** 函數引用穩定，減少不必要的 useEffect 觸發

### **3. 使用 useMemo**

```javascript
const memoizedVideos = useMemo(() => {
  return videos;
}, [videos]);
```

**好處：** 防止 VideoGrid 不必要的重新渲染

### **4. Refs 避免閉包**

```javascript
// 使用 refs 保存最新值，避免 useEffect 閉包問題
const searchRef = useRef('');
const sortRef = useRef('popular');
const pageRef = useRef(1);

// 在 IntersectionObserver 中讀取最新值
const searchQuery = searchRef.current;
const sortType = sortRef.current;
const nextPage = (pageRef.current || 1) + 1;
```

---

## 🚀 **未來增強**

- [ ] 添加分類篩選（動漫、寫實、風景等）
- [ ] 添加分級篩選（全年齡、18+）
- [ ] 添加「回到頂部」按鈕
- [ ] 添加載入骨架屏（Skeleton）
- [ ] 支援鍵盤快捷鍵切換排序
- [ ] 記住用戶的排序偏好（LocalStorage）

---

## ✅ **完成狀態**

- ✅ 排序選擇器
- ✅ 無限滾動
- ✅ 分頁載入
- ✅ 載入狀態提示
- ✅ 與首頁功能對齊
- ✅ 效能優化
- ✅ 文檔撰寫

---

**影片頁面現在擁有與首頁相同的強大功能！** 🎉🚀


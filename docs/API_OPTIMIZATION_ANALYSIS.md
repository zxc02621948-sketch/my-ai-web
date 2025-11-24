# API調用優化分析報告

## 🔍 發現的重複/多餘API調用

---

## 1️⃣ **ImageModal - 重複獲取user信息** ⚠️ **中等優先級**

### 問題位置
`components/image/ImageModal.jsx` (第158-191行)

### 問題描述
```javascript
// 若 user 是字串 → 補抓作者物件
useEffect(() => {
  if (!image) return;
  const u = image.user ?? image.userId;
  if (!u || typeof u !== "string") return;

  // 第一次嘗試：調用 /api/user/${u}
  const r = await fetch(`/api/user/${u}`, { cache: "no-store" });
  
  // 如果失敗，第二次嘗試：調用 /api/images/${image._id}
  if (!userObj && image?._id) {
    const r2 = await fetch(`/api/images/${image._id}`, { cache: "no-store" });
    userObj = d2?.image?.user || null;
  }
}, [image]);
```

### 問題分析
- ⚠️ **重複調用**：如果第一次API失敗，會調用圖片詳情API
- ⚠️ **但圖片詳情API已經populate了user信息**：詳情API已經包含了user對象
- ⚠️ **性能影響**：可能導致兩次API調用（第一次失敗時）

### 優化建議
1. **如果第一次API調用失敗，圖片詳情API應該已經包含了user信息**
   - 可以檢查 `image.user` 是否已經被populate（如果是對象，就不需要再調用）
   - 只有在 `image.user` 是字符串且圖片詳情API也失敗時才需要處理

2. **或者**：直接調用圖片詳情API（因為它已經包含了user信息）

### 風險評估
- **風險等級**：低
- **影響**：邊緣情況（user是字符串且第一個API失敗）
- **優化收益**：中等（減少一次API調用）

---

## 2️⃣ **MusicInfoBox - 重複獲取當前用戶信息** ⚠️ **低優先級**

### 問題位置
`components/music/MusicInfoBox.jsx` (第84-112行)

### 問題描述
```javascript
// 獲取播放清單信息
useEffect(() => {
  if (!currentUser) return;
  
  const fetchPlaylistInfo = async () => {
    // 調用 /api/user-info?id=${currentUser._id} 獲取播放列表
    const response = await axios.get("/api/user-info", {
      params: { id: currentUser._id },
      headers: { 'Cache-Control': 'no-cache' }
    });
    // ...
  };
  
  fetchPlaylistInfo();
}, [currentUser, music?.musicUrl]);
```

### 問題分析
- ⚠️ **可能多餘**：`currentUser` 可能已經包含播放列表信息
- ⚠️ **每次打開音樂modal都會調用**：即使播放列表沒有變化
- ⚠️ **沒有緩存**：`Cache-Control: no-cache` 每次都重新獲取

### 優化建議
1. **檢查currentUser是否已經包含播放列表信息**
   ```javascript
   // 如果 currentUser 已經有播放列表，直接使用
   if (currentUser?.playlist && currentUser?.playlistMaxSize) {
     setPlaylist(currentUser.playlist);
     setPlaylistMaxSize(currentUser.playlistMaxSize);
     return;
   }
   ```

2. **添加緩存機制**
   - 使用sessionStorage或localStorage緩存播放列表信息
   - 或者使用Context共享播放列表數據

3. **只在需要時調用**
   - 只在currentUser改變或播放列表可能變化時調用
   - 添加依賴項檢查

### 風險評估
- **風險等級**：低
- **影響**：每次打開音樂modal都會調用
- **優化收益**：中等（如果添加緩存）

---

## 3️⃣ **app/user/[id]/page.jsx - enrichImage重複獲取user信息** ⚠️ **中等優先級**

### 問題位置
`app/user/[id]/page.jsx` (第711-738行)

### 問題描述
```javascript
const enrichImage = async (img) => {
  // 1) 調用圖片詳情API獲取完整數據
  const r = await axios.get(`/api/images/${img._id}`);
  const apiImage = r?.data?.image || r?.data;
  
  // 2) 如果user信息不足，再調用user-info API
  if (authorId && (!full.user || !full.user.username)) {
    const u = await axios.get(`/api/user-info?id=${authorId}`);
    if (u?.data) full = { ...full, user: u.data };
  }
};
```

### 問題分析
- ⚠️ **圖片詳情API已經populate了user信息**：詳情API返回的數據已經包含user對象
- ⚠️ **可能多餘的API調用**：如果圖片詳情API返回的user信息完整，就不需要再調用user-info API

### 優化建議
1. **檢查圖片詳情API返回的user信息**
   ```javascript
   // 檢查 apiImage.user 是否已經完整
   if (apiImage?.user && typeof apiImage.user === 'object' && apiImage.user.username) {
     // user信息已經完整，不需要再調用user-info API
     full.user = apiImage.user;
   } else if (authorId && (!full.user || !full.user.username)) {
     // 只有當user信息不完整時才調用user-info API
     const u = await axios.get(`/api/user-info?id=${authorId}`);
     if (u?.data) full = { ...full, user: u.data };
   }
   ```

### 風險評估
- **風險等級**：低
- **影響**：每次enrichImage時可能多調用一次API
- **優化收益**：中等（減少API調用）

---

## 4️⃣ **app/store/page.jsx - 多次調用user-info API** ⚠️ **低優先級**

### 問題位置
`app/store/page.jsx` (第83, 199, 245, 348行)

### 問題描述
在購買操作後，多次調用 `/api/user-info` 來更新用戶信息：
- 第83行：初始載入時調用
- 第199行：購買播放器體驗券後調用
- 第245行：購買訂閱後調用
- 第348行：購買頭像框後調用

### 問題分析
- ⚠️ **可以優化**：購買操作後，可以使用API返回的數據更新本地狀態，而不是重新調用user-info API
- ⚠️ **或者**：使用Context的更新機制，通過事件廣播更新

### 優化建議
1. **使用API返回的數據**
   ```javascript
   // 購買成功後，API通常會返回更新後的用戶信息
   const response = await axios.post("/api/store/purchase", { productId });
   if (response.data?.user) {
     setUserInfo(response.data.user); // 直接使用API返回的數據
     return; // 不需要再調用user-info API
   }
   ```

2. **使用事件廣播**
   - 購買操作後，廣播 `points-updated` 或 `user-data-updated` 事件
   - 其他組件監聽事件更新狀態

### 風險評估
- **風險等級**：低
- **影響**：購買操作後的額外API調用
- **優化收益**：中等（減少API調用，提升響應速度）

---

## 5️⃣ **ClientHeaderWrapper - 每日登入後調用user-info** ✅ **已優化**

### 問題位置
`components/common/ClientHeaderWrapper.jsx` (第103行)

### 問題描述
每日登入後調用 `/api/user-info` 來更新用戶信息。

### 問題分析
- ✅ **這是必要的**：每日登入可能改變積分，需要獲取最新數據
- ✅ **已優化**：使用事件廣播更新其他組件

### 結論
**不需要優化**，這是必要的API調用。

---

## 6️⃣ **app/user/[id]/page.jsx - 用戶頁面可能重複調用user-info** ⚠️ **低優先級**

### 問題位置
`app/user/[id]/page.jsx` (第406行, 第691行, 第737行)

### 問題描述
用戶頁面中多次調用 `/api/user-info`：
- 第406行：載入用戶頁面數據時調用
- 第691行：enrichImage時如果作者信息不足調用
- 第737行：enrichImage時如果user信息不足調用

### 問題分析
- ⚠️ **可能有緩存機會**：如果已經獲取了用戶信息，可以緩存起來，避免重複調用

### 優化建議
1. **添加用戶信息緩存**
   ```javascript
   const userInfoCache = new Map();
   
   const getUserInfo = async (userId) => {
     if (userInfoCache.has(userId)) {
       return userInfoCache.get(userId);
     }
     const response = await axios.get(`/api/user-info?id=${userId}`);
     if (response.data) {
       userInfoCache.set(userId, response.data);
       // 設置過期時間（例如5分鐘）
       setTimeout(() => userInfoCache.delete(userId), 5 * 60 * 1000);
     }
     return response.data;
   };
   ```

### 風險評估
- **風險等級**：低
- **影響**：用戶頁面可能多次獲取相同用戶的信息
- **優化收益**：中等（添加緩存後）

---

## 📊 優化優先級總結

| 問題 | 位置 | 優先級 | 風險 | 收益 | 建議 |
|------|------|--------|------|------|------|
| **enrichImage重複獲取user** | `app/user/[id]/page.jsx` | 🟡 中等 | 低 | 中等 | ✅ 檢查API返回數據 |
| **ImageModal重複獲取user** | `components/image/ImageModal.jsx` | 🟡 中等 | 低 | 中等 | ✅ 優化調用順序 |
| **MusicInfoBox獲取播放列表** | `components/music/MusicInfoBox.jsx` | 🟢 低 | 低 | 中等 | ✅ 添加緩存或檢查currentUser |
| **store頁面多次調用user-info** | `app/store/page.jsx` | 🟢 低 | 低 | 中等 | ✅ 使用API返回數據 |
| **用戶信息緩存** | `app/user/[id]/page.jsx` | 🟢 低 | 低 | 中等 | ✅ 添加緩存機制 |

---

## 💡 通用優化建議

### 1. 添加用戶信息緩存
```javascript
// utils/userInfoCache.js
const userInfoCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘

export async function getUserInfoCached(userId, force = false) {
  const cached = userInfoCache.get(userId);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const response = await axios.get(`/api/user-info?id=${userId}`);
  if (response.data) {
    userInfoCache.set(userId, {
      data: response.data,
      timestamp: Date.now()
    });
  }
  return response.data;
}
```

### 2. 使用Context共享數據
- 使用 `CurrentUserContext` 共享當前用戶數據
- 避免多個組件重複獲取相同數據

### 3. 檢查API返回數據
- 在調用額外API之前，先檢查已獲取的數據是否完整
- 避免不必要的API調用

---

## 🎯 建議實施順序

### 優先級1：高收益低風險
1. ✅ **優化enrichImage函數**（檢查API返回的user信息）
2. ✅ **優化ImageModal**（檢查user是否已經populate）

### 優先級2：中等收益
3. ✅ **添加用戶信息緩存**（減少重複調用）
4. ✅ **優化MusicInfoBox**（檢查currentUser是否已有播放列表）

### 優先級3：低優先級
5. ✅ **優化store頁面**（使用API返回數據）


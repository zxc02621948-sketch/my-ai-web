# 🧪 多圖教學帖功能測試指南

## 📋 測試準備

1. 確保開發服務器正在運行：`npm run dev`
2. 在瀏覽器打開：`http://localhost:3000`
3. 確保已登入（用戶：cvb120g）

---

## 🧪 測試方案 A：瀏覽器控制台測試（最簡單）

### 測試 1：檢查當前積分

打開瀏覽器控制台（F12），執行：

```javascript
// 檢查當前積分
fetch('/api/current-user')
  .then(res => res.json())
  .then(data => {
    console.log('當前積分:', data.pointsBalance);
    console.log('累計獲得:', data.totalEarnedPoints);
  });
```

### 測試 2：創建測試多圖帖子

```javascript
// 創建一個測試多圖帖子（模擬）
const testPost = async () => {
  const formData = new FormData();
  formData.append('title', '【測試】多圖教學 - 如何設定播放器');
  formData.append('content', '這是測試內容\\n{{image:0}}\\n步驟1\\n{{image:1}}\\n步驟2');
  formData.append('category', 'tutorial');
  
  // 創建2個測試圖片文件（1x1透明PNG）
  const blob = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==').then(r => r.blob());
  formData.append('uploadedImages[0]', blob, 'test1.png');
  formData.append('uploadedImages[1]', blob, 'test2.png');
  
  const response = await fetch('/api/discussion/posts', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  console.log('📝 創建結果:', result);
  
  if (result.success) {
    console.log('✅ 帖子ID:', result.data._id);
    console.log('💰 消耗積分:', result.pointsCost);
  } else {
    console.log('❌ 錯誤:', result.error);
  }
  
  return result;
};

// 執行測試
testPost();
```

### 測試 3：模擬點讚（積分獎勵）

```javascript
// 先獲取上面創建的帖子ID，然後：
const postId = 'YOUR_POST_ID_HERE'; // 替換為實際ID

fetch(`/api/discussion/posts/${postId}/like`, {
  method: 'POST'
})
  .then(res => res.json())
  .then(data => {
    console.log('👍 點讚結果:', data);
    console.log('💰 作者是否獲得積分:', data.pointsRewarded);
  });
```

### 測試 4：查看積分記錄

```javascript
// 再次檢查積分
fetch('/api/current-user')
  .then(res => res.json())
  .then(data => {
    console.log('更新後積分:', data.pointsBalance);
  });
```

---

## 🧪 測試方案 B：手動UI測試（需前端完成）

**注意：前端UI尚未完全完成，可以先用方案A測試**

1. 前往：http://localhost:3000/discussion/create
2. 填寫標題和內容
3. 上傳 2-5 張圖片
4. 查看積分提示（應顯示需要 5 積分）
5. 點擊「發布帖子」
6. 檢查積分是否扣除

---

## 🧪 測試方案 C：Postman 測試（專業）

### 1. 獲取當前用戶信息
```
GET http://localhost:3000/api/current-user
Headers: Cookie: (從瀏覽器複製)
```

### 2. 創建多圖帖子
```
POST http://localhost:3000/api/discussion/posts
Content-Type: multipart/form-data
Headers: Cookie: (從瀏覽器複製)

Body (form-data):
- title: 測試多圖教學
- content: 測試內容\\n{{image:0}}\\n步驟1
- category: tutorial
- uploadedImages[0]: (選擇圖片文件)
- uploadedImages[1]: (選擇圖片文件)
```

### 3. 測試點讚
```
POST http://localhost:3000/api/discussion/posts/{帖子ID}/like
Headers: Cookie: (從瀏覽器複製)
```

---

## ✅ 預期結果

### 創建帖子時：
- ✅ 2-5張圖：扣除 5 積分
- ✅ 6-9張圖：扣除 10 積分
- ✅ 積分不足：返回錯誤
- ✅ 每日超過5個多圖帖：返回錯誤

### 收到愛心時：
- ✅ 多圖教學帖：作者獲得 1 積分
- ✅ 普通帖子：作者不獲得積分
- ✅ 自己點讚自己：不獲得積分

### 積分記錄：
- ✅ `discussion_post_cost`：發帖消耗
- ✅ `discussion_like_reward`：愛心獎勵

---

## 🐛 常見問題

### Q: 積分扣除了但沒記錄？
A: 檢查 PointsTransaction 表是否有記錄

### Q: 點讚沒有積分獎勵？
A: 確認是否為多圖教學帖（imageCount >= 2 且 pointsCost > 0）

### Q: 無法創建帖子？
A: 檢查積分是否足夠，是否超過每日限制

---

## 📊 測試完成檢查清單

- [ ] 積分正確扣除
- [ ] 多圖帖子創建成功
- [ ] 點讚給予積分獎勵
- [ ] 普通帖子點讚不給積分
- [ ] 積分記錄完整
- [ ] 每日限制生效
- [ ] 積分不足時阻止發帖

---

## 💡 下一步

測試完成後，我會繼續完成：
1. 前端多圖上傳UI
2. 圖片插入系統（{{image:N}}）
3. 帖子詳情頁渲染
4. 用戶提示和引導


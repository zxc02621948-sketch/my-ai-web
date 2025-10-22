# 單個留言 API 端點

> **創建日期：** 2025-10-22  
> **用途：** 獲取單個圖片留言的詳細資訊

---

## 🎯 **API 端點**

```
GET /api/comments/single/[commentId]
```

---

## 📋 **用途**

此 API 用於獲取單個圖片留言的詳細資訊，主要用於：
- 管理員檢舉列表查看被檢舉的留言內容
- 其他需要獲取特定留言的場景

---

## 🔧 **與現有 API 的區別**

### **現有 API:**
```
GET /api/comments/[imageId]
```
- 根據 `imageId` 獲取該圖片的所有留言
- 返回留言數組

### **新 API:**
```
GET /api/comments/single/[commentId]
```
- 根據 `commentId` 獲取單個留言
- 返回單個留言對象

---

## 📝 **請求示例**

```javascript
// 獲取留言 ID 為 68f851776e2aa0227ed031dc 的留言
const response = await fetch('/api/comments/single/68f851776e2aa0227ed031dc', {
  cache: "no-store"
});

const data = await response.json();
```

---

## 📊 **響應格式**

### **成功響應 (200):**

```json
{
  "comment": {
    "_id": "68f851776e2aa0227ed031dc",
    "text": "這是留言內容",
    "userId": "688d7b8f37f458cc460f1438",
    "userName": "用戶名稱",
    "userImage": "f014f03c-39d4-4f4d-a158-4725d0487000",
    "userFrame": "leaves",
    "imageId": "68957c8008fd2f62d0fa00f3",
    "createdAt": "2025-10-22T10:30:00.000Z",
    "parentCommentId": null
  }
}
```

### **留言不存在 (404):**

```json
{
  "error": "留言不存在"
}
```

### **缺少留言 ID (400):**

```json
{
  "error": "缺少留言 ID"
}
```

### **伺服器錯誤 (500):**

```json
{
  "error": "伺服器錯誤"
}
```

---

## 🔍 **數據結構**

| 欄位 | 類型 | 說明 |
|-----|------|------|
| `_id` | String | 留言 ID |
| `text` | String | 留言內容 |
| `userId` | String | 留言作者 ID |
| `userName` | String | 留言作者名稱 |
| `userImage` | String | 留言作者頭像 |
| `userFrame` | String | 留言作者頭像框 |
| `imageId` | String | 所屬圖片 ID |
| `createdAt` | Date | 創建時間 |
| `parentCommentId` | String \| null | 父留言 ID（回覆） |

---

## 💡 **使用場景**

### **1. 管理員檢舉列表**

```javascript
// app/admin/reports/page.jsx
async function fetchDiscussionContent(targetId, type) {
  if (type === 'image_comment') {
    const r = await fetch(`/api/comments/single/${targetId}`, { 
      cache: "no-store" 
    });
    const j = await r.json();
    return j?.comment || null;
  }
  // ...
}
```

### **2. 其他用途**

```javascript
// 獲取特定留言的詳細資訊
async function getCommentDetails(commentId) {
  try {
    const response = await fetch(`/api/comments/single/${commentId}`);
    const data = await response.json();
    
    if (data.comment) {
      console.log('留言內容:', data.comment.text);
      console.log('作者:', data.comment.userName);
    } else {
      console.error('留言不存在');
    }
  } catch (error) {
    console.error('獲取留言失敗:', error);
  }
}
```

---

## 🔒 **權限**

- **公開訪問** - 無需登入
- **無敏感資訊** - 只返回公開的留言資訊

---

## 🎯 **實現細節**

### **查詢邏輯:**

```javascript
const comment = await Comment.findById(commentId)
  .populate({
    path: "userId",
    select: "username image currentFrame frameSettings",
  })
  .lean();
```

### **數據格式化:**

```javascript
const formattedComment = {
  _id: comment._id.toString(),
  text: comment.text,
  userId: comment.userId?._id?.toString() || null,
  userName: comment.userId?.username || "匿名用戶",
  userImage: comment.userId?.image || "/default-avatar.png",
  userFrame: comment.userId?.currentFrame || "default",
  imageId: comment.imageId,
  createdAt: comment.createdAt,
  parentCommentId: comment.parentCommentId,
};
```

---

## ✅ **優勢**

1. **精確查詢** - 直接根據留言 ID 查詢，不需要遍歷所有留言
2. **性能優化** - 避免查詢整個圖片的留言數組
3. **靈活使用** - 可用於多種需要單個留言的場景
4. **一致性** - 返回格式與現有留言 API 一致

---

## 🎊 **總結**

**新 API 的作用：**
- ✅ 根據留言 ID 獲取單個留言
- ✅ 用於管理員檢舉列表顯示被檢舉的留言內容
- ✅ 提供完整的留言資訊（包括作者資訊）
- ✅ 無需權限即可訪問（公開留言）

**現在管理員檢舉列表可以正確顯示被檢舉的圖片留言內容了！** 🎉✨


# 圖片留言檢舉功能修復

> **修復日期：** 2025-10-22  
> **問題：** 檢舉 API 返回 400 錯誤

---

## 🐛 **問題描述**

**錯誤日誌：**
```
POST /api/reports 400 in 1311ms
```

**原因：**
- API 端點 `/api/reports` 只處理 `discussion_post` 和 `discussion_comment` 類型
- 圖片留言檢舉使用的 `image_comment` 類型沒有被處理
- 導致 API 跳過留言檢舉邏輯，進入圖片檢舉邏輯
- 因為沒有 `imageId` 參數，返回 400 錯誤

---

## ✅ **修復方案**

### **修改 `app/api/reports/route.js`**

**Before：**
```javascript
// 檢查是否為討論區檢舉
if (type === 'discussion_post' || type === 'discussion_comment') {
  // ... 處理討論區檢舉
}

// 原有的圖片檢舉邏輯
if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
  return NextResponse.json({ ok: false, message: "無效的圖片 ID" }, { status: 400 });
}
```

**After：**
```javascript
// 檢查是否為留言檢舉（討論區或圖片留言）
if (type === 'discussion_post' || type === 'discussion_comment' || type === 'image_comment') {
  // ... 處理留言檢舉
  
  // 新增：處理圖片留言檢舉
  else if (type === 'image_comment') {
    const Comment = (await import('@/models/Comment')).default;
    const comment = await Comment.findById(targetId).select('userId').lean();
    if (comment) targetAuthor = comment.userId;
  }
  
  // ... 創建檢舉記錄
  return NextResponse.json({ ok: true, reportId: doc._id, message: "檢舉已提交" });
}

// 原有的圖片檢舉邏輯（只處理 imageId 存在的情況）
if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
  return NextResponse.json({ ok: false, message: "無效的圖片 ID" }, { status: 400 });
}
```

---

## 🎯 **支持的檢舉類型**

### **1. 圖片檢舉** ✅
```json
{
  "imageId": "68957c8008fd2f62d0fa00f3",
  "type": "category_wrong",
  "message": "分類錯誤"
}
```

### **2. 討論區貼文檢舉** ✅
```json
{
  "type": "discussion_post",
  "targetId": "68f851776e2aa0227ed031dc",
  "reason": "違反社群規範"
}
```

### **3. 討論區留言檢舉** ✅
```json
{
  "type": "discussion_comment",
  "targetId": "68f851776e2aa0227ed031dc",
  "reason": "辱罵他人"
}
```

### **4. 圖片留言檢舉** ✅ 修復
```json
{
  "type": "image_comment",
  "targetId": "68f851776e2aa0227ed031dc",
  "reason": "灌水留言",
  "details": "11"
}
```

---

## 🔒 **安全檢查**

### **所有檢舉類型都會檢查：**

1. **必須登入** ✅
   ```javascript
   const { user, error } = await requireUser();
   if (error) return error;
   ```

2. **不能檢舉自己** ✅
   ```javascript
   if (targetAuthor && String(targetAuthor) === String(user._id)) {
     return NextResponse.json({ ok: false, message: "不能檢舉自己的內容" }, { status: 400 });
   }
   ```

3. **必須提供原因** ✅
   ```javascript
   if (!reason || !reason.trim()) {
     return NextResponse.json({ ok: false, message: "請提供檢舉原因" }, { status: 400 });
   }
   ```

4. **必須提供目標 ID** ✅
   ```javascript
   if (!targetId) {
     return NextResponse.json({ ok: false, message: "缺少目標 ID" }, { status: 400 });
   }
   ```

---

## 🎊 **測試步驟**

### **1. 登入你的帳號**
```
✅ 確認右上角顯示頭像
```

### **2. 找到別人的留言**
```
✅ 不是你自己發的留言
```

### **3. 點擊「🚩 檢舉」**
```
✅ 彈出「檢舉留言」對話框
```

### **4. 填寫檢舉原因**
```
例如：「這是灌水留言」
```

### **5. 點擊「提交檢舉」**
```
✅ 應該顯示「檢舉成功」通知
```

---

## 📊 **API 響應**

### **成功：**
```json
{
  "ok": true,
  "reportId": "68f851776e2aa0227ed031dc",
  "message": "檢舉已提交"
}
```

### **失敗（自己的留言）：**
```json
{
  "ok": false,
  "message": "不能檢舉自己的內容"
}
```

### **失敗（未填寫原因）：**
```json
{
  "ok": false,
  "message": "請提供檢舉原因"
}
```

---

## ✅ **修復完成**

**現在圖片留言檢舉功能應該可以正常工作了！** 🎉

**測試看看：**
1. 找到別人的留言
2. 點擊「🚩 檢舉」
3. 填寫原因
4. 提交

**應該會顯示：「檢舉成功」通知** ✨


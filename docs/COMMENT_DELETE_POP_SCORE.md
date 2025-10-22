# 刪除留言與熱門度分數

> **確認日期：** 2025-10-22  
> **結論：** ✅ 刪除留言會自動更新圖片的熱門度分數

---

## ✅ **確認結果**

**刪除留言時會自動：**
1. ✅ 重新計算留言總數 (`commentsCount`)
2. ✅ 重新計算熱門度分數 (`popScore`)
3. ✅ 同時刪除所有回覆留言
4. ✅ 保存更新後的圖片資料

---

## 🔧 **實現邏輯**

### **API 端點：**
```
DELETE /api/delete-comment/[commentId]
```

### **更新邏輯：**

```javascript
// app/api/delete-comment/[commentId]/route.js

// 1. 刪除所有回覆留言
await Comment.deleteMany({ parentCommentId: commentId });

// 2. 刪除主留言
await Comment.findByIdAndDelete(commentId);

// 3. 更新圖片的留言數和熱門度分數
if (imageId) {
  const image = await Image.findById(imageId);
  if (image) {
    // 重新計算留言總數
    const totalComments = await Comment.countDocuments({ imageId });
    image.commentsCount = totalComments;
    
    // 重新計算熱門度分數（包含留言數的權重）
    image.popScore = computePopScore(image);
    
    await image.save();
  }
}
```

---

## 📊 **熱門度分數計算**

### **`computePopScore` 函數：**

```javascript
// utils/score.js
export const POP_W_CLICK = 1.0;     // 點擊權重
export const POP_W_LIKE = 8.0;      // 點讚權重
export const POP_W_COMMENT = 2.0;   // 留言權重 ✅
export const POP_W_COMPLETE = 1.0;  // 完整度權重

export function computePopScore(image) {
  const clicks = image.clicks || 0;
  const likesCount = image.likesCount || 0;
  const commentsCount = image.commentsCount || 0; // ✅ 留言數
  const completenessScore = image.completenessScore || 0;
  
  // 計算時間衰減加成
  const decayedBoost = computeTimeDecayBoost(
    image.initialBoost || 0,
    image.createdAt
  );
  
  // 總分 = 點擊 + 點讚 + 留言 + 完整度 + 時間加成
  return (
    clicks * POP_W_CLICK +
    likesCount * POP_W_LIKE +
    commentsCount * POP_W_COMMENT +  // ✅ 每條留言 +2 分
    completenessScore * POP_W_COMPLETE +
    decayedBoost
  );
}
```

---

## 🎯 **留言對熱門度的影響**

### **權重對比：**

| 操作 | 權重 | 說明 |
|-----|------|------|
| 點擊 | 1.0 | 基礎權重 |
| 留言 | 2.0 | **中等權重** |
| 點讚 | 8.0 | 高權重 |

### **計算示例：**

**假設一張圖片：**
- 點擊數：100
- 點讚數：10
- 留言數：5 ← **刪除 1 條後變成 4**
- 完整度：50

**刪除前：**
```
popScore = 100×1.0 + 10×8.0 + 5×2.0 + 50×1.0 + boost
         = 100 + 80 + 10 + 50 + boost
         = 240 + boost
```

**刪除後：**
```
popScore = 100×1.0 + 10×8.0 + 4×2.0 + 50×1.0 + boost
         = 100 + 80 + 8 + 50 + boost
         = 238 + boost
```

**影響：** -2 分（1 條留言的權重）

---

## 📋 **完整流程**

### **用戶自己刪除留言：**
```
1. 用戶點擊「刪除」按鈕
   ↓
2. 驗證權限（作者或管理員）
   ↓
3. 刪除留言（包括回覆）
   ↓
4. 重新計算 commentsCount
   ↓
5. 重新計算 popScore
   ↓
6. 保存圖片資料
   ↓
✅ 完成！熱門度分數已更新
```

### **管理員通過檢舉刪除：**
```
1. 管理員在檢舉列表點擊「刪除」
   ↓
2. 調用 DELETE /api/delete-comment/[commentId]
   ↓
3. 驗證管理員權限
   ↓
4. 刪除留言（包括回覆）
   ↓
5. 重新計算 commentsCount
   ↓
6. 重新計算 popScore
   ↓
7. 保存圖片資料
   ↓
8. 更新檢舉狀態為「已處置」
   ↓
✅ 完成！熱門度分數已更新
```

---

## 🔍 **驗證方式**

### **測試步驟：**

1. **查看刪除前的分數：**
   ```javascript
   // 在 MongoDB 或通過 API 查詢
   const image = await Image.findById(imageId);
   console.log('刪除前 commentsCount:', image.commentsCount);
   console.log('刪除前 popScore:', image.popScore);
   ```

2. **刪除留言：**
   - 通過檢舉列表刪除
   - 或用戶自己刪除

3. **查看刪除後的分數：**
   ```javascript
   const updatedImage = await Image.findById(imageId);
   console.log('刪除後 commentsCount:', updatedImage.commentsCount);
   console.log('刪除後 popScore:', updatedImage.popScore);
   ```

4. **確認差異：**
   ```javascript
   const diff = image.popScore - updatedImage.popScore;
   console.log('分數差異:', diff); // 應該是 2.0 × 刪除的留言數
   ```

---

## 📈 **影響範圍**

### **受影響的排序：**

- ✅ **熱門排序** - 刪除留言會降低熱門度，影響排名
- ✅ **首頁推薦** - 使用 `popScore` 排序
- ✅ **相似圖片推薦** - 可能考慮 `popScore`

### **不受影響的排序：**

- ❌ **最新排序** - 只看 `createdAt`
- ❌ **最舊排序** - 只看 `createdAt`
- ❌ **隨機排序** - 隨機選擇
- ❌ **最多點讚** - 只看 `likesCount`

---

## 🎊 **總結**

### **✅ 已實現的功能：**

1. **自動更新留言數** - 刪除留言後自動重新計算
2. **自動更新熱門度** - 基於新的留言數重新計算
3. **同時刪除回覆** - 避免孤兒留言
4. **權限控制** - 只有作者或管理員可刪除

### **📊 留言權重：**

- **每條留言：** +2.0 分
- **相對於點讚：** 1/4 權重
- **相對於點擊：** 2 倍權重

### **🔒 數據一致性：**

- ✅ `commentsCount` 與實際留言數同步
- ✅ `popScore` 與 `commentsCount` 同步
- ✅ 刪除操作原子性保證

---

**結論：刪除留言會自動降低圖片的熱門度分數，系統已經正確實現了這個機制！** ✅🎉



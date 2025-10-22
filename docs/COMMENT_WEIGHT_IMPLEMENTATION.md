# 留言權重系統實施完成

> **更新日期：** 2025-10-21  
> **狀態：** ✅ 已完成

---

## 🎯 **核心設計**

### **留言 = 討論度 = 受歡迎度**

**邏輯：**
```
高討論度 → 引起關注 → 受歡迎
沒人討論 → 沒人在意 → 不受歡迎
```

**權重設計：**
```
1 個讚 = 8 分
1 條留言 = 2 分

也就是說：
4 條留言 = 1 個讚的影響力
```

---

## 📊 **新的熱門度公式**

### **完整公式：**
```javascript
popScore = 
  (clicks × 1.0) +          // 點擊（打開 Modal）
  (likesCount × 8.0) +      // 點讚（明確喜歡）
  (commentsCount × 2.0) +   // ✅ 新增：留言（討論度）
  (completeness × 0.05) +   // 完整度
  finalBoost                // 新內容加成
```

### **權重對比：**
| 互動類型 | 權重 | 說明 |
|---------|------|------|
| 點讚 | 8.0 | 最重要（明確的正向反饋） |
| 留言 | 2.0 | ✅ 新增（討論價值） |
| 點擊 | 1.0 | 基礎（有興趣打開） |
| 完整度 | 0.05 | 最低（參考加成） |

---

## 🔧 **實施的修改**

### **1. models/Image.js** ✅
```javascript
commentsCount: { type: Number, default: 0 }  // 新增欄位
```

### **2. utils/score.js** ✅
```javascript
// 新增權重常數
export const POP_W_COMMENT = 2.0;

// 更新計算公式
export function computePopScore(x = {}) {
  const clicks = toNum(x.clicks, 0);
  const likesCount = ensureLikesCount(x);
  const commentsCount = toNum(x.commentsCount, 0);  // ✅ 新增
  const comp = toNum(x.completenessScore, 0);
  const decayedBoost = computeInitialBoostDecay(x);
  
  return (
    clicks * POP_W_CLICK + 
    likesCount * POP_W_LIKE + 
    commentsCount * POP_W_COMMENT +  // ✅ 新增
    comp * POP_W_COMPLETE + 
    decayedBoost
  );
}
```

### **3. app/api/comments/[id]/route.js** ✅
```javascript
// POST 留言時
const totalComments = await Comment.countDocuments({ imageId });
image.commentsCount = totalComments;
image.popScore = computePopScore(image);
await image.save();
```

### **4. app/api/delete-comment/[commentId]/route.js** ✅
```javascript
// DELETE 留言時
const totalComments = await Comment.countDocuments({ imageId });
image.commentsCount = totalComments;
image.popScore = computePopScore(image);
await image.save();
```

### **5. app/api/images/[id]/click/route.js** ✅
```javascript
// 點擊時抓取 commentsCount
const fresh = await Image.findById(
  id,
  "clicks likes likesCount commentsCount ..."  // ✅ 加入 commentsCount
);
```

---

## 📈 **實際影響示例**

### **範例 1：技術討論作品**
```
圖片 A：
- 20 個讚 = 160 分
- 15 條留言 = 30 分  ← 新增
- 10 次點擊 = 10 分
- 完整度 60 = 3 分
- 總分 = 203 分

vs 之前：160 + 10 + 3 = 173 分
提升：+30 分（17.3%）✅ 高討論度確實提升排名
```

### **範例 2：純欣賞作品**
```
圖片 B：
- 50 個讚 = 400 分
- 0 條留言 = 0 分
- 5 次點擊 = 5 分
- 完整度 50 = 2.5 分
- 總分 = 407.5 分

✅ 高點讚還是主導（400 vs 30）
```

### **範例 3：爭議作品**
```
圖片 C（技術錯誤，很多人指正）：
- 5 個讚 = 40 分
- 20 條留言（批評）= 40 分  ← 新增
- 15 次點擊 = 15 分
- 總分 = 95 分

vs 圖片 B（407.5 分）
✅ 即使留言多，還是比不上真正受歡迎的作品
```

---

## 🧪 **測試方法**

### **測試 1：發布留言**

1. **選擇一張圖片，記錄初始分數：**
```javascript
fetch('/api/images?page=1&limit=5')
  .then(res => res.json())
  .then(data => {
    const img = data.images[0];
    console.log('圖片:', img.title);
    console.log('留言數:', img.commentsCount || 0);
    console.log('popScore:', img.popScore);
  });
```

2. **在這張圖片下留言**

3. **再次查詢：**
```javascript
fetch('/api/images?page=1&limit=5')
  .then(res => res.json())
  .then(data => {
    const img = data.images[0];
    console.log('留言後:');
    console.log('留言數:', img.commentsCount);
    console.log('popScore:', img.popScore);
    console.log('應增加: +2 分');
  });
```

---

### **測試 2：刪除留言**

1. **刪除剛才的留言**
2. **查詢分數：**
```javascript
// 留言數應該 -1
// popScore 應該 -2
```

---

### **測試 3：批量同步（現有圖片）**

如果你有現有的圖片已經有留言，需要執行同步腳本：

**方法 1：使用腳本（推薦）**
```bash
node scripts/sync-comments-count.js
```

**方法 2：使用瀏覽器 Console**
```javascript
// 為所有圖片同步留言數
fetch('/api/admin/sync-comments', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('✅ 同步完成', data));
```

---

## 📊 **權重平衡性分析**

### **互動成本 vs 影響力：**

| 互動 | 成本 | 權重 | 效率 |
|------|------|------|------|
| 點讚 | 低（1秒） | 8.0 | 高（8分/秒） |
| 留言 | 中（30秒） | 2.0 | 低（0.067分/秒） |
| 點擊 | 極低（即時） | 1.0 | 中（1分/次） |

**結論：**
- ✅ 點讚仍然是最有效的支持方式
- ✅ 留言需要更多時間，但獎勵較低
- ✅ 避免「刷留言」（成本高、收益低）
- ✅ 鼓勵有意義的討論（不是灌水）

---

## 🎯 **防刷機制**

### **為什麼權重設為 2.0？**

**如果設太高（例如 5.0）：**
- ❌ 4 條留言 = 20 分 > 2 個讚（16分）
- ❌ 可能導致無意義留言（「+1」「讚」「好看」）
- ❌ 留言區質量下降

**設為 2.0：**
- ✅ 4 條留言 = 8 分 = 1 個讚
- ✅ 需要大量留言才能抵1個讚
- ✅ 鼓勵有深度的討論（值得寫長篇）
- ✅ 避免無意義灌水（投資報酬率低）

---

## 🚀 **未來優化方向**

### **1. 留言質量權重（進階）**

```javascript
// 根據留言長度給予不同權重
短留言（< 10字）：1.0 分
中等留言（10-50字）：2.0 分
長留言（> 50字）：3.0 分
```

### **2. 留言點讚系統**

```javascript
// 高讚的留言額外加分
留言獲得 10+ 讚 → 圖片額外 +1 分
```

### **3. 作者回覆加成**

```javascript
// 作者積極回覆 → 額外加分
作者回覆率 > 50% → +5 分
```

---

## ✅ **完成清單**

- ✅ Image 模型添加 `commentsCount` 欄位
- ✅ 更新分數計算公式（+留言權重）
- ✅ 發布留言時自動更新
- ✅ 刪除留言時自動更新
- ✅ 點擊 API 包含留言數
- ✅ 創建同步腳本
- ✅ 文檔撰寫

---

## 🎊 **總結**

### **現在的熱門度公式：**
```
popScore = 
  點讚 × 8 +      ← 最重要
  留言 × 2 +      ← ✅ 新增
  點擊 × 1 +
  完整度 × 0.05 +
  新內容加成
```

### **效果：**
- ✅ 高討論度的作品會獲得更高排名
- ✅ 技術討論價值得到認可
- ✅ 點讚仍然是主導因素
- ✅ 防止刷留言（成本高、收益低）

---

**留言權重系統已完整實施！** 🎉✨

**從現在開始：**
- 發布留言 → commentsCount +1 → popScore +2
- 刪除留言 → commentsCount -1 → popScore -2
- 高討論度的作品會自動排名提升！

**測試看看吧！去某張圖片留言，然後看看它的排名是否提升！** 🚀



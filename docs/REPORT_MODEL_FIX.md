# Report 模型修復 - 添加圖片留言檢舉類型

> **修復日期：** 2025-10-22  
> **錯誤：** `image_comment` is not a valid enum value

---

## 🐛 **錯誤訊息**

```
POST /api/reports error: Error: Report validation failed: 
type: `image_comment` is not a valid enum value for path `type`.
```

---

## 🔍 **問題原因**

`models/Report.js` 的 `type` 欄位只定義了這些允許值：

```javascript
enum: [
  // 圖片檢舉類型
  "category_wrong","rating_wrong","duplicate","broken","policy_violation","other",
  // 討論區檢舉類型
  "discussion_post","discussion_comment"
]
```

但是圖片留言檢舉使用的 `image_comment` 類型不在列表中！

---

## ✅ **修復方案**

### **修改 `models/Report.js`**

**添加 `image_comment` 到 enum：**

```javascript
type: {
  type: String,
  enum: [
    // 圖片檢舉類型
    "category_wrong","rating_wrong","duplicate","broken","policy_violation","other",
    // 討論區檢舉類型
    "discussion_post","discussion_comment",
    // 圖片留言檢舉類型 ✅ 新增
    "image_comment"
  ],
  required: true
},
```

---

## 🔄 **重啟開發伺服器**

**重要：** 模型定義改變後，必須重啟開發伺服器！

### **方法 1：終端重啟**

```bash
# 按 Ctrl+C 停止開發伺服器
# 然後重新啟動
npm run dev
```

### **方法 2：自動重啟（推薦）**

模型檔案修改後，Next.js 應該會自動重新編譯，但如果遇到問題，手動重啟更保險。

---

## 🎯 **支持的檢舉類型**

### **現在完整的列表：**

| 類型 | 說明 | 用途 |
|-----|------|------|
| `category_wrong` | 分類錯誤 | 圖片檢舉 |
| `rating_wrong` | 分級錯誤 | 圖片檢舉 |
| `duplicate` | 重複/洗版 | 圖片檢舉 |
| `broken` | 壞圖/無法顯示 | 圖片檢舉 |
| `policy_violation` | 站規違規 | 圖片檢舉 |
| `other` | 其他 | 圖片檢舉 |
| `discussion_post` | 討論區貼文檢舉 | 討論區 |
| `discussion_comment` | 討論區留言檢舉 | 討論區 |
| `image_comment` ✅ | **圖片留言檢舉** | **圖片留言** |

---

## 📋 **測試步驟**

### **1. 重啟開發伺服器**
```bash
Ctrl+C → npm run dev
```

### **2. 重新整理瀏覽器**
```
Ctrl+F5 (強制刷新)
```

### **3. 測試檢舉功能**
1. 找到別人的留言
2. 點擊「🚩 檢舉」
3. 填寫原因
4. 提交

### **4. 檢查終端日誌**

**成功：**
```
POST /api/reports 200 in 50ms
```

**失敗：**
```
POST /api/reports 500 in 50ms
Report validation failed...
```

---

## ✅ **完整修復清單**

### **1. 修改 API (`app/api/reports/route.js`)** ✅
- 添加 `image_comment` 類型處理
- 查詢留言作者
- 檢查不能檢舉自己

### **2. 修改模型 (`models/Report.js`)** ✅
- 在 `type` enum 中添加 `image_comment`

### **3. 重啟開發伺服器** ⏳
- 必須重啟才能載入新的模型定義

---

## 🎊 **現在應該可以正常工作了！**

**完整流程：**

1. ✅ 前端顯示檢舉按鈕
2. ✅ 點擊打開檢舉彈窗
3. ✅ 填寫原因並提交
4. ✅ API 處理 `image_comment` 類型
5. ✅ 模型驗證通過（新增 enum 值）
6. ✅ 成功創建檢舉記錄
7. ✅ 顯示成功通知

---

**重啟開發伺服器後，試試看檢舉功能應該就可以正常工作了！** 🎉✨


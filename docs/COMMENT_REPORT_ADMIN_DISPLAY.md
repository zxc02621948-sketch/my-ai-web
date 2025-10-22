# 檢舉列表顯示被檢舉的留言內容

> **更新日期：** 2025-10-22  
> **新增：** 管理員檢舉列表顯示被檢舉的留言內容

---

## 🎯 **功能說明**

在管理員檢舉列表 (`/admin/reports`) 中，現在會同時顯示：
1. **被檢舉的內容**（留言/帖子/評論的實際內容）
2. **檢舉原因**（檢舉人填寫的原因）

---

## ✅ **修改內容**

### **1. 添加圖片留言類型**

**修改檔案：** `app/admin/reports/page.jsx`

#### **A. 類型選項：**
```javascript
const TYPE_OPTIONS = [
  // ... 其他類型
  { value: "discussion_post",    label: "💬 討論帖子" },
  { value: "discussion_comment", label: "💬 討論評論" },
  { value: "image_comment",      label: "💬 圖片留言" }, // ✅ 新增
];
```

---

### **2. 獲取留言內容**

#### **A. 修改 `fetchDiscussionContent` 函數：**
```javascript
async function fetchDiscussionContent(targetId, type) {
  // ... 討論區帖子和評論的邏輯
  
  // ✅ 新增：圖片留言
  else if (type === 'image_comment') {
    const r = await fetch(`/api/comments/${targetId}`, { cache: "no-store" });
    const j = await r.json();
    if (j) {
      if (Array.isArray(j)) {
        return j.find(c => String(c._id) === String(targetId)) || null;
      }
      return j;
    }
    return null;
  }
}
```

#### **B. 修改快取邏輯：**
```javascript
const needFetchDiscussion = (j.items || [])
  .filter(it => (
    it.type === 'discussion_post' || 
    it.type === 'discussion_comment' || 
    it.type === 'image_comment' // ✅ 新增
  ) && it.targetId)
  // ...
```

---

### **3. 顯示被檢舉的內容**

#### **A. 修改表格顯示：**
```javascript
<td className="px-3 py-2 max-w-[320px]">
  <div className="space-y-2">
    {/* ✅ 新增：被檢舉的內容 */}
    {isDiscussion && discussionContent && (
      <>
        <div className="text-sm text-rose-400 font-semibold">被檢舉的內容:</div>
        <div className="text-zinc-300 text-sm line-clamp-2 bg-zinc-800/50 p-2 rounded border-l-2 border-rose-500">
          {r.type === 'discussion_post' && discussionContent.title && (
            <div className="font-medium mb-1">「{discussionContent.title}」</div>
          )}
          {r.type === 'discussion_post' && discussionContent.content && (
            <div className="text-xs">{discussionContent.content.substring(0, 80)}...</div>
          )}
          {r.type === 'discussion_comment' && discussionContent.content && (
            <div className="text-xs">{discussionContent.content.substring(0, 100)}...</div>
          )}
          {r.type === 'image_comment' && discussionContent.text && (
            <div className="text-xs">「{discussionContent.text.substring(0, 100)}」</div>
          )}
        </div>
      </>
    )}
    
    {/* 檢舉原因 */}
    <div className="text-sm text-amber-400 font-semibold">檢舉原因:</div>
    <div className="text-zinc-300 text-sm line-clamp-3">
      {r.message || r.details || <span className="text-zinc-500">—</span>}
    </div>
  </div>
</td>
```

---

### **4. 刪除功能**

#### **A. 修改 `deleteDiscussionContent` 函數：**
```javascript
async function deleteDiscussionContent(report) {
  const contentType = report.type === 'discussion_post' ? '帖子' : 
                      report.type === 'discussion_comment' ? '評論' : 
                      '留言'; // ✅ 新增
  
  // ...
  
  let endpoint = '';
  if (report.type === 'discussion_post') {
    endpoint = `/api/discussion/posts/${report.targetId}`;
  } else if (report.type === 'discussion_comment') {
    endpoint = `/api/discussion/comments/${report.targetId}`;
  } else if (report.type === 'image_comment') {
    endpoint = `/api/delete-comment/${report.targetId}`; // ✅ 新增
  }
  
  // ...
}
```

---

## 🎨 **UI 示例**

### **檢舉列表顯示：**

```
┌────────────────────────────────────────────────────────────┐
│ 圖片  │ 類型       │ 狀態   │ 說明                        │
├───────┼───────────┼────────┼─────────────────────────────┤
│ 💬    │ 圖片留言   │ 待處理 │ 被檢舉的內容:                │
│       │           │        │ 「11」                        │
│       │           │        │                               │
│       │           │        │ 檢舉原因:                     │
│       │           │        │ 這是灌水留言                  │
└───────┴───────────┴────────┴─────────────────────────────┘
```

### **完整示例：**

```
┌──────────────────────────────────────────────────────────────┐
│ 💬  圖片留言                                                  │
│     「11」                                                     │
│     作者: testuser                                            │
├──────────────────────────────────────────────────────────────┤
│ 類型: 💬 圖片留言                                             │
│ 狀態: 待處理                                                  │
├──────────────────────────────────────────────────────────────┤
│ 被檢舉的內容:                                                 │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 「11」                                                  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ 檢舉原因:                                                     │
│ 這是灌水留言                                                  │
├──────────────────────────────────────────────────────────────┤
│ 操作: [刪除] [查看] [駁回]                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 **數據結構對比**

### **討論區帖子：**
```javascript
discussionContent = {
  title: "帖子標題",
  content: "帖子內容...",
  authorName: "作者名稱"
}
```

### **討論區評論：**
```javascript
discussionContent = {
  content: "評論內容...",
  author: { username: "作者名稱" }
}
```

### **圖片留言：**
```javascript
discussionContent = {
  text: "留言內容...",  // ✅ 注意：是 text 不是 content
  userName: "作者名稱"   // ✅ 注意：是 userName 不是 authorName
}
```

---

## 🔧 **API 端點**

### **獲取圖片留言：**
```
GET /api/comments/{targetId}
```

### **刪除圖片留言：**
```
DELETE /api/delete-comment/{targetId}
```

---

## ✅ **完成功能**

### **1. 顯示功能** ✅
- ✅ 顯示被檢舉的留言內容
- ✅ 顯示檢舉原因
- ✅ 區分不同類型（帖子/評論/留言）
- ✅ 留言內容高亮顯示（紅色邊框）

### **2. 刪除功能** ✅
- ✅ 管理員可刪除圖片留言
- ✅ 刪除後更新檢舉狀態
- ✅ 刪除成功通知

### **3. 篩選功能** ✅
- ✅ 可按「圖片留言」類型篩選
- ✅ 顯示在類型下拉選單中

---

## 🎊 **使用方式**

### **管理員操作流程：**

1. **進入檢舉列表** → `/admin/reports`
2. **篩選圖片留言** → 選擇「💬 圖片留言」
3. **查看被檢舉內容** → 「被檢舉的內容:」區塊
4. **查看檢舉原因** → 「檢舉原因:」區塊
5. **處理檢舉** → 
   - 點擊「刪除」→ 刪除留言並標記為已處置
   - 點擊「駁回」→ 標記為駁回

---

**現在管理員可以清楚看到被檢舉的留言內容和檢舉原因了！** 🎉✨


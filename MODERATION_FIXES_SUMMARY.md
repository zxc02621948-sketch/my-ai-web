# ✅ 檢舉系統與站內信整合 - 修復完成報告

## 📅 **修復日期**: 2025-10-15

---

## 🎯 **修復目標**

1. ✅ 修復更改分類/分級功能 - API 整合斷裂
2. ✅ 添加檢舉狀態更新通知 - 檢舉人反饋
3. ✅ 統一通知系統 - 使用 `Message` 而非 `Notification`
4. ✅ 補充站內信模板 - 支持所有操作類型

---

## 🔧 **詳細修復內容**

### 1️⃣ **修復更改分類/分級功能** ✅

#### **問題描述**:
- 前端 `AdminModerationBar.jsx` 發送 `adminAction: 'reclassify'` 或 `'rerate'`
- 後端 `/api/delete-image` **只處理刪除**，不處理這些參數
- 管理員無法通過前端正常更改圖片分類或分級

#### **修復內容**:
**檔案**: `app/api/delete-image/route.js`

1. **新增參數支持**:
   ```javascript
   const adminAction = (body?.adminAction ?? q.adminAction ?? "delete").trim().toLowerCase();
   const newCategory = (body?.newCategory ?? q.newCategory ?? "").trim();
   const newRating = (body?.newRating ?? q.newRating ?? "").trim();
   const note = typeof (body?.note ?? q.note) === "string" ? (body?.note ?? q.note) : "";
   ```

2. **實現三種操作**:
   - **`delete`** (刪除) - 原有功能
   - **`reclassify`** (更改分類) - 新增功能
   - **`rerate`** (更改分級) - 新增功能

3. **更改分類邏輯**:
   ```javascript
   if (adminAction === "reclassify") {
     const fullImage = await Image.findById(image._id);
     const oldCategory = fullImage.category || "未分類";
     fullImage.category = newCategory;
     await fullImage.save();
     
     operationResult = { oldCategory, newCategory };
     operationSummary = `已將分類從「${oldCategory}」調整為「${newCategory}」`;
     if (!actionKey) actionKey = "recat.category_fixed";
   }
   ```

4. **更改分級邏輯**:
   ```javascript
   else if (adminAction === "rerate") {
     const fullImage = await Image.findById(image._id);
     const oldRating = fullImage.rating || "all";
     fullImage.rating = newRating;
     await fullImage.save();
     
     operationResult = { oldRating, newRating };
     operationSummary = `已將分級從「${oldRating}」調整為「${newRating}」`;
     if (!actionKey) actionKey = "rerate.fix_label";
   }
   ```

5. **更新檢舉狀態**:
   ```javascript
   const resolution = adminAction === "reclassify" ? "reclassified" : 
                     adminAction === "rerate" ? "rerated" : "deleted";
   ```

6. **站內信上下文**:
   ```javascript
   const ctx = {
     user: { username: owner?.username || "" },
     image: { _id: String(image._id), title: image.title || "", imageId: image.imageId || "" },
     username: owner?.username || "",
     imageTitle: image.title || "",
     imageUuid: image.imageId || "",
     reason: reason || "",
     ...operationResult, // 包含 oldCategory/newCategory 或 oldRating/newRating
   };
   ```

7. **回傳結果**:
   ```javascript
   return json({
     ok: true,
     action: adminAction,
     message: operationSummary || "操作完成",
     summary: operationSummary,
     imageId: String(image._id),
     ...operationResult,
     mode,
     notifyUsed: notify,
     notify: notifyResult,
   }, 200, { "X-Delete-Image-Route": "v12.0" });
   ```

#### **測試方法**:
```javascript
// 測試更改分類
fetch("/api/delete-image", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({
    imageId: "67890abcdef",
    adminAction: "reclassify",
    newCategory: "風景",
    note: "分類錯誤，應為風景類",
    notify: true
  })
});

// 測試更改分級
fetch("/api/delete-image", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({
    imageId: "67890abcdef",
    adminAction: "rerate",
    newRating: "18+",
    note: "內容包含成人元素",
    notify: true
  })
});
```

---

### 2️⃣ **添加檢舉狀態更新通知** ✅

#### **問題描述**:
- 管理員更新檢舉狀態時，檢舉人不會收到任何通知
- 檢舉人不知道檢舉結果（通過/駁回/結案）

#### **修復內容**:
**檔案**: `app/api/reports/[id]/route.js`

1. **新增匯入**:
   ```javascript
   import Message from "@/models/Message";
   import Image from "@/models/Image";
   import { renderTemplate } from "@/utils/notifTemplates";
   ```

2. **取得原始檢舉資料**:
   ```javascript
   const originalReport = await Report.findById(id).lean();
   ```

3. **發送通知邏輯**:
   ```javascript
   if (originalReport.reporterId && (normalized === "rejected" || normalized === "action_taken" || normalized === "closed")) {
     // 取得圖片資訊
     let imageInfo = { title: "未知圖片", _id: originalReport.imageId };
     if (originalReport.imageId) {
       const img = await Image.findById(originalReport.imageId).select("title _id imageId").lean();
       if (img) imageInfo = { title: img.title || "無標題", _id: img._id, imageId: img.imageId };
     }

     // 選擇模板
     let templateKey = "report.closed";
     if (normalized === "rejected") templateKey = "report.rejected";
     else if (normalized === "action_taken") templateKey = "report.action_taken";

     const ctx = {
       image: imageInfo,
       note: update.note || "",
       action: normalized === "action_taken" ? "已處理" : normalized === "rejected" ? "不成立" : "已結案",
     };

     const tpl = renderTemplate(templateKey, ctx);

     await Message.create({
       conversationId: `pair:${String(originalReport.reporterId)}:system`,
       fromId: null,
       toId: originalReport.reporterId,
       subject: tpl.subject || tpl.title || "檢舉處理結果通知",
       body: tpl.body || "",
       kind: "system",
       ref: {
         type: "other",
         id: originalReport._id,
         extra: { reportStatus: normalized, imageId: originalReport.imageId }
       },
     });
   }
   ```

4. **回傳結果**:
   ```javascript
   return new NextResponse(
     JSON.stringify({ ok: true, item: updated, notify: notifyResult }), 
     { status: 200, headers }
   );
   ```

#### **通知觸發條件**:
- ✅ 檢舉被**駁回** (`rejected`) → 通知檢舉人
- ✅ 檢舉**已處理** (`action_taken`) → 通知檢舉人
- ✅ 檢舉**已結案** (`closed`) → 通知檢舉人
- ❌ 檢舉**重新開啟** (`open`) → 不通知（內部操作）

---

### 3️⃣ **統一通知系統** ✅

#### **問題描述**:
- `modRecategory` 使用 `Notification` 模型
- `delete-image` 使用 `Message` 模型
- 用戶需要在兩個地方查看通知

#### **修復內容**:
**檔案**: `services/moderationService.js`

**統一所有管理員操作使用 `Message` 模型**:

1. **`modRecategory`** (更改分級):
   ```javascript
   await Message.create({
     conversationId: `pair:${String(targetUserId)}:system`,
     fromId: null,
     toId: targetUserId,
     subject: title || "您的作品分級已調整",
     body: body || "",
     kind: "system",
     ref: {
       type: "image",
       id: imageId,
       extra: { oldRating, newRating, reasonCode, actionId: action._id }
     }
   });
   ```

2. **`modTakedown`** (下架作品):
   ```javascript
   await Message.create({
     conversationId: `pair:${String(targetUserId)}:system`,
     fromId: null,
     toId: targetUserId,
     subject: title || "作品因違規已下架",
     body: body || "",
     kind: "system",
     ref: {
       type: "image",
       id: imageId,
       extra: { warningLevel, reasonCode, actionId: action._id }
     }
   });
   ```

3. **`modWarn`** (警告用戶):
   ```javascript
   await Message.create({
     conversationId: `pair:${String(targetUserId)}:system`,
     fromId: null,
     toId: targetUserId,
     subject: title || `帳號警告（Level ${level}）`,
     body: body || "",
     kind: "system",
     ref: {
       type: "other",
       extra: { warningLevel: level, reasonCode, actionId: action._id }
     }
   });
   ```

#### **優點**:
- ✅ 用戶只需查看一個地方（站內信）
- ✅ 統一的通知體驗
- ✅ 可以回覆管理員（申訴功能）
- ✅ 更好的追蹤和管理

---

### 4️⃣ **補充站內信模板** ✅

#### **新增模板**:
**檔案**: `utils/notifTemplates.js`

1. **更改分類模板** (`recat.category_fixed`):
   ```javascript
   "recat.category_fixed": {
     title: "您的作品分類已調整",
     body: [
       "您好 {{user.username}}，",
       "",
       "我們在審查「{{image.title}}」（ID: {{image._id}}）時發現分類與內容不符，已將分類由「{{oldCategory}}」調整為「{{newCategory}}」。",
       "{{#if reason}}原因：{{reason}}{{/if}}",
       "",
       "注意：請確保未來上傳時選擇正確的分類，避免影響曝光或造成用戶困擾。",
       "{{#if appealUrl}}若您認為有誤，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
     ].join("\n"),
   }
   ```

2. **更改分級模板** (`rerate.fix_label`):
   ```javascript
   "rerate.fix_label": {
     title: "您的作品分級已調整",
     body: [
       "您好 {{user.username}}，",
       "",
       "我們在審查「{{image.title}}」（ID: {{image._id}}）時發現分級與內容不符，已將分級由「{{oldRating}}」調整為「{{newRating}}」。",
       "{{#if reason}}原因：{{reason}}{{/if}}",
       "",
       "注意：若再次發生，可能導致帳號警告或限制曝光。請確保未來上傳時選擇正確的分級。",
       "{{#if appealUrl}}若您認為有誤，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
     ].join("\n"),
   }
   ```

3. **檢舉駁回模板** (`report.rejected`):
   ```javascript
   "report.rejected": {
     title: "檢舉處理結果通知",
     body: [
       "您好，",
       "",
       "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉經審核後不成立。",
       "{{#if note}}管理員備註：{{note}}{{/if}}",
       "",
       "感謝您協助維護社群品質。若未來發現違規內容，歡迎繼續回報。",
     ].join("\n"),
   }
   ```

4. **檢舉通過模板** (`report.action_taken`):
   ```javascript
   "report.action_taken": {
     title: "檢舉處理結果通知",
     body: [
       "您好，",
       "",
       "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉已處理完成。",
       "{{#if action}}處理結果：{{action}}{{/if}}",
       "{{#if note}}管理員備註：{{note}}{{/if}}",
       "",
       "感謝您協助維護社群品質！",
     ].join("\n"),
   }
   ```

5. **檢舉結案模板** (`report.closed`):
   ```javascript
   "report.closed": {
     title: "檢舉已結案",
     body: [
       "您好，",
       "",
       "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉已結案。",
       "{{#if note}}備註：{{note}}{{/if}}",
       "",
       "感謝您的回報。",
     ].join("\n"),
   }
   ```

---

## 📊 **修復前後對比**

| 功能 | 修復前 | 修復後 |
|------|--------|--------|
| **更改分類** | ❌ API 斷裂，無法使用 | ✅ 完整支持，自動發送站內信 |
| **更改分級** | ⚠️ 使用 `Notification`，前端斷裂 | ✅ 統一使用 `Message`，完整支持 |
| **刪除圖片** | ✅ 正常運作 | ✅ 保持正常，增強回傳資訊 |
| **檢舉駁回通知** | ❌ 無通知 | ✅ 自動發送站內信給檢舉人 |
| **檢舉通過通知** | ❌ 無通知 | ✅ 自動發送站內信給檢舉人 |
| **檢舉結案通知** | ❌ 無通知 | ✅ 自動發送站內信給檢舉人 |
| **通知系統** | ⚠️ 混用 `Message` 和 `Notification` | ✅ 統一使用 `Message` |

---

## 🎯 **完整的通知流程**

### **場景 1: 管理員刪除違規圖片**
1. 管理員在後台處理檢舉，選擇「刪除」
2. 系統刪除圖片
3. ✅ **自動發送站內信給圖片作者**（說明刪除原因）
4. ✅ **自動發送站內信給檢舉人**（告知已處理）
5. 檢舉狀態更新為 `action_taken`

### **場景 2: 管理員更改圖片分級**
1. 管理員在後台處理檢舉，選擇「更改分級」
2. 系統更新圖片分級（例如從 `all` 改為 `18+`）
3. ✅ **自動發送站內信給圖片作者**（說明分級調整原因）
4. ✅ **自動發送站內信給檢舉人**（告知已處理）
5. 檢舉狀態更新為 `action_taken`

### **場景 3: 管理員更改圖片分類**
1. 管理員在後台處理檢舉，選擇「更改分類」
2. 系統更新圖片分類（例如從「人物」改為「風景」）
3. ✅ **自動發送站內信給圖片作者**（說明分類調整原因）
4. ✅ **自動發送站內信給檢舉人**（告知已處理）
5. 檢舉狀態更新為 `action_taken`

### **場景 4: 管理員駁回檢舉**
1. 管理員審核檢舉，認為不成立
2. 更新檢舉狀態為 `rejected`
3. ✅ **自動發送站內信給檢舉人**（說明駁回原因）
4. 圖片作者不受影響

### **場景 5: 管理員結案檢舉**
1. 管理員處理完畢，將檢舉結案
2. 更新檢舉狀態為 `closed`
3. ✅ **自動發送站內信給檢舉人**（告知已結案）

---

## 🧪 **測試建議**

### **測試 1: 更改分類功能**
```javascript
// 1. 上傳一張測試圖片（分類選錯）
// 2. 檢舉該圖片（選擇「分類錯誤」）
// 3. 管理員處理：選擇「更改分類」
// 4. 確認：
//    - 圖片分類已更新 ✓
//    - 圖片作者收到站內信 ✓
//    - 檢舉人收到站內信 ✓
//    - 檢舉狀態為 action_taken ✓
```

### **測試 2: 更改分級功能**
```javascript
// 1. 上傳一張測試圖片（分級選錯）
// 2. 檢舉該圖片（選擇「分級錯誤」）
// 3. 管理員處理：選擇「更改分級」
// 4. 確認：
//    - 圖片分級已更新 ✓
//    - 圖片作者收到站內信 ✓
//    - 檢舉人收到站內信 ✓
//    - 檢舉狀態為 action_taken ✓
```

### **測試 3: 檢舉駁回通知**
```javascript
// 1. 檢舉一張正常圖片
// 2. 管理員處理：駁回檢舉
// 3. 確認：
//    - 檢舉人收到駁回通知 ✓
//    - 圖片作者未受影響 ✓
//    - 檢舉狀態為 rejected ✓
```

---

## 📝 **API 使用範例**

### **範例 1: 更改分類**
```javascript
POST /api/delete-image
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "imageId": "67890abcdef12345",
  "adminAction": "reclassify",
  "newCategory": "風景",
  "note": "此圖應歸類為風景，而非人物",
  "notify": true,
  "reportId": "report_id_here"  // 可選
}

// 回應
{
  "ok": true,
  "action": "reclassify",
  "message": "已將分類從「人物」調整為「風景」",
  "summary": "已將分類從「人物」調整為「風景」",
  "imageId": "67890abcdef12345",
  "oldCategory": "人物",
  "newCategory": "風景",
  "notify": {
    "ok": true,
    "conversationId": "pair:user123:system",
    "messageId": "msg456",
    "actionKey": "recat.category_fixed"
  }
}
```

### **範例 2: 更改分級**
```javascript
POST /api/delete-image
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "imageId": "67890abcdef12345",
  "adminAction": "rerate",
  "newRating": "18+",
  "note": "圖片包含成人內容，應為 18+ 分級",
  "notify": true
}

// 回應
{
  "ok": true,
  "action": "rerate",
  "message": "已將分級從「all」調整為「18+」",
  "summary": "已將分級從「all」調整為「18+」",
  "imageId": "67890abcdef12345",
  "oldRating": "all",
  "newRating": "18+",
  "notify": {
    "ok": true,
    "conversationId": "pair:user123:system",
    "messageId": "msg789",
    "actionKey": "rerate.fix_label"
  }
}
```

### **範例 3: 更新檢舉狀態（駁回）**
```javascript
PATCH /api/reports/report_id_123
Content-Type: application/json

{
  "status": "rejected",
  "note": "經審核，該圖片內容並無違規"
}

// 回應
{
  "ok": true,
  "item": {
    "_id": "report_id_123",
    "status": "rejected",
    "note": "經審核，該圖片內容並無違規",
    "imageId": "67890abcdef12345",
    "reporterId": "user456",
    // ... 其他欄位
  },
  "notify": {
    "sent": true,
    "to": "user456",
    "template": "report.rejected"
  }
}
```

---

## ✅ **所有修復已完成**

- ✅ **修復 1**: 更改分類/分級功能 - API 整合完成
- ✅ **修復 2**: 檢舉狀態更新通知 - 自動發送站內信
- ✅ **修復 3**: 統一通知系統 - 全部使用 `Message`
- ✅ **修復 4**: 補充站內信模板 - 5 個新模板

---

## 🎉 **總結**

所有檢舉系統與站內信的整合問題已全部修復！現在：

1. ✅ 管理員可以**正常更改分類和分級**
2. ✅ 所有管理員操作都會**自動發送站內信**給相關用戶
3. ✅ 檢舉人可以**收到處理結果通知**
4. ✅ 通知系統**完全統一**，用戶體驗一致
5. ✅ 所有模板**完整且專業**

系統現在擁有完整的檢舉處理流程和通知機制！🚀


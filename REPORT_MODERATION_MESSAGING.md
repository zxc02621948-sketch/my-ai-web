# 🔍 檢舉系統與站內信整合審查報告

## ✅ **狀態：所有問題已修復完成** (2025-10-15)

詳細修復內容請參閱：**`MODERATION_FIXES_SUMMARY.md`**

---

## 📊 **審查範圍**
- 檢舉系統 (`/api/reports`)
- 管理員操作 API (`/api/delete-image`, `/api/mod/*`)
- 站內信系統 (`/api/messages/*`)
- 通知模板 (`utils/notifTemplates.js`)
- 管理後台前端 (`app/admin/reports/page.jsx`)

---

## ✅ **已完善的功能**

### 1. **刪除圖片** ✅
- **API**: `/api/delete-image` (POST)
- **站內信**: ✅ **已實現**
  - 使用 `Message` 模型發送站內信
  - 支持模板系統 (`renderTemplate`)
  - 根據檢舉類型自動選擇模板
- **模板支持**:
  - `takedown.category_wrong` - 分類錯誤
  - `takedown.rating_wrong` - 分級錯誤
  - `takedown.duplicate_spam` - 重複/洗版
  - `takedown.broken_image` - 壞圖/無法顯示
  - `takedown.policy_violation` - 站規違規
  - `takedown.other_with_note` - 其他（需說明）
  - `takedown.nsfw_in_sfw` - NSFW 內容放在 SFW 分區
- **觸發條件**: 
  - 管理員刪除圖片時，自動發送站內信給圖片作者
  - 通過 `notify` 參數控制（預設為 true）
  - 檢舉處理時自動更新檢舉狀態為 `resolved: true`

**代碼示例**:
```javascript
// app/api/delete-image/route.js (第 226-280 行)
if (notify) {
  const tpl = renderTemplate(actionKey, ctx);
  const msg = await Message.create({
    conversationId: `pair:${String(ownerId)}:system`,
    fromId: null,
    toId: ownerId,
    subject: tpl.subject || tpl.title || "(系統通知)",
    body: tpl.body || "",
    isSystem: true,
    meta: {
      actionKey,
      imageRef: { _id: image._id, imageId: image.imageId, title: image.title },
      reportId: reportDoc?._id || null,
    },
  });
}
```

---

### 2. **更改分級** (部分實現)
- **API**: `/api/mod/recategory` (POST)
- **通知**: ✅ 使用 `Notification` 模型（**不是站內信 `Message`**）
- **模板**: `recat.nsfw_to_sfw`
- **問題**: 
  - ❌ 前端 `AdminModerationBar.jsx` 呼叫 `/api/delete-image` 並傳遞 `adminAction: 'rerate'`，但後端未處理
  - ❌ `/api/mod/recategory` 存在但前端沒有使用
  - ✅ 通知系統已實現（使用 `Notification`）

**代碼示例**:
```javascript
// services/moderationService.js (第 17-44 行)
export async function modRecategory({ operatorId, imageId, targetUserId, oldRating, newRating, reasonCode, reasonText }) {
  const action = await ModerationAction.create({
    operatorId, targetUserId, imageId, action: "RECAT",
    reasonCode, reasonText, oldRating, newRating,
    templateKey: "recat.nsfw_to_sfw",
  });

  if (NOTIF_ENABLED) {
    const { title, body } = renderTemplate("recat.nsfw_to_sfw", ctx);
    await Notification.create({
      userId: targetUserId, type: "recategory", title, body,
      meta: { imageId, oldRating, newRating, reasonCode, actionId: action._id }
    });
  }
}
```

---

### 3. **更改分類** ❌ (未實現)
- **API**: ❌ 不存在專用 API
- **站內信**: ❌ 未實現
- **前端**: ❌ `AdminModerationBar.jsx` 呼叫 `/api/delete-image` 並傳遞 `adminAction: 'reclassify'`，但後端未處理
- **建議**: 創建 `/api/mod/reclassify` 或在 `/api/delete-image` 中添加支持

---

### 4. **檢舉狀態更新** (基本實現)
- **API**: `/api/reports/[id]` (PATCH)
- **功能**: 更新檢舉狀態 (`open`, `action_taken`, `rejected`, `closed`)
- **站內信**: ❌ **未實現**
- **問題**: 
  - ❌ 管理員更新檢舉狀態時，不會通知檢舉人或被檢舉人
  - ❌ 駁回檢舉時，檢舉人不會收到通知
  - ❌ 結案時，相關人員不會收到通知

**代碼示例**:
```javascript
// app/api/reports/[id]/route.js (第 88-142 行)
export async function PATCH(req, context) {
  const normalized = guessFromAny(rawStatus, payload);
  const update = { status: normalized };
  if (typeof payload.note === "string") update.note = payload.note.slice(0, 2000);

  const updated = await Report.findByIdAndUpdate(id, update, { new: true }).lean();
  
  // ❌ 缺少通知邏輯
  
  return new NextResponse(JSON.stringify({ ok: true, item: updated }), { status: 200, headers });
}
```

---

## ❌ **需要修復的問題**

### 問題 1: **更改分類/分級功能斷裂**
**現象**:
- 前端 `AdminModerationBar.jsx` 發送 `adminAction: 'reclassify'` 或 `'rerate'`
- 後端 `/api/delete-image` **不處理這些參數**
- 後端存在 `/api/mod/recategory`，但**前端沒有使用**

**影響**:
- 管理員無法通過前端正常更改圖片分類或分級
- 用戶不會收到更改通知

**修復方案**:
1. **方案 A（推薦）**: 修改 `/api/delete-image` 支持 `adminAction: 'reclassify'` 和 `'rerate'`
2. **方案 B**: 修改前端 `AdminModerationBar.jsx` 呼叫正確的 API (`/api/mod/recategory`)

---

### 問題 2: **檢舉狀態更新缺少通知**
**現象**:
- 管理員更新檢舉狀態時，沒有通知相關用戶

**影響**:
- 檢舉人不知道檢舉結果（通過/駁回）
- 被檢舉人不知道檢舉被駁回（無需處理）

**修復方案**:
在 `/api/reports/[id]` 的 PATCH 中添加通知邏輯：
```javascript
// 示例代碼
if (normalized === "rejected") {
  // 通知檢舉人：檢舉被駁回
  await Message.create({
    conversationId: `pair:${String(report.reporterId)}:system`,
    fromId: null,
    toId: report.reporterId,
    subject: "檢舉處理結果通知",
    body: "您的檢舉經審核後不成立，已駁回。",
    kind: "system",
  });
} else if (normalized === "action_taken") {
  // 通知檢舉人：檢舉成功
  await Message.create({
    conversationId: `pair:${String(report.reporterId)}:system`,
    fromId: null,
    toId: report.reporterId,
    subject: "檢舉處理結果通知",
    body: "您的檢舉已處理，感謝您的回報。",
    kind: "system",
  });
}
```

---

### 問題 3: **通知系統不統一**
**現象**:
- 刪除圖片使用 `Message` 模型（站內信）
- 更改分級使用 `Notification` 模型（系統通知）
- 兩者用戶體驗不一致

**影響**:
- 用戶需要在兩個地方查看通知（站內信 + 系統通知）
- 開發維護複雜度增加

**建議**:
1. **統一使用站內信** (`Message` 模型) 作為主要通知方式
2. 保留 `Notification` 作為輕量級提醒（例如點讚、評論）
3. 重要操作（刪除、更改分級、警告）統一使用站內信

---

### 問題 4: **站內信模板不完整**
**現象**:
- 更改分類沒有專用模板
- 檢舉駁回/通過沒有模板

**修復方案**:
添加以下模板到 `utils/notifTemplates.js`:
```javascript
// 更改分類
"recat.category_fixed": {
  title: "您的作品分類已調整",
  body: [
    "您好 {{user.username}}，",
    "",
    "您上傳的「{{image.title}}」（ID: {{image._id}}）的分類已由 {{oldCategory}} 調整為 {{newCategory}}。",
    "原因：{{reason}}",
    "",
    "{{#if appealUrl}}若您認為有誤，可提出申訴：{{appealUrl}}{{/if}}",
  ].join("\n"),
},

// 檢舉駁回（通知檢舉人）
"report.rejected": {
  title: "檢舉處理結果通知",
  body: [
    "您好，",
    "",
    "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉經審核後不成立。",
    "{{#if note}}管理員備註：{{note}}{{/if}}",
    "",
    "感謝您協助維護社群品質。",
  ].join("\n"),
},

// 檢舉通過（通知檢舉人）
"report.action_taken": {
  title: "檢舉處理結果通知",
  body: [
    "您好，",
    "",
    "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉已處理完成。",
    "處理結果：{{action}}",
    "{{#if note}}管理員備註：{{note}}{{/if}}",
    "",
    "感謝您協助維護社群品質！",
  ].join("\n"),
},
```

---

## 📝 **建議的修復優先級**

### 🔴 **高優先級** (影響核心功能)
1. **修復更改分類/分級功能** - 管理員操作斷裂
2. **添加檢舉狀態更新通知** - 用戶體驗問題

### 🟡 **中優先級** (優化用戶體驗)
3. **統一通知系統** - 使用 `Message` 作為主要通知方式
4. **補充站內信模板** - 支持所有操作類型

### 🟢 **低優先級** (長期優化)
5. **重構管理員操作 API** - 統一 API 設計
6. **添加申訴系統** - 模板中已預留 `appealUrl`

---

## 🎯 **總結**

### ✅ **已實現且完善**
- 刪除圖片的站內信通知
- 站內信系統基礎架構
- 模板渲染系統

### ⚠️ **部分實現但有問題**
- 更改分級（使用 `Notification` 而非 `Message`）
- 檢舉系統（缺少狀態更新通知）

### ❌ **未實現**
- 更改分類功能（API 斷裂）
- 檢舉駁回/通過通知
- 統一的通知體驗

---

## 🛠️ **下一步行動**

建議按以下順序修復：

1. **立即修復**: 更改分類/分級功能（API 整合）
2. **近期添加**: 檢舉狀態更新通知
3. **長期優化**: 統一通知系統架構

您希望我先處理哪一個問題？


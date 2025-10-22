# 影片系統完整總結

> **更新日期：** 2025-10-21  
> **狀態：** 已完成基礎功能 + 未來擴展預留

---

## 🎯 核心設計理念

### 內容定位
```
圖片 = 技術主力
├─ 完整的 AI 生成參數
├─ 技術討論和學習
├─ 長期參考價值
└─ 支援權力券推廣

影片 = 視覺吸引力 + 消耗品
├─ 視覺衝擊力強
├─ 生成門檻低（線上平台）
├─ 快速迭代，內容過期快
└─ 不支援權力券推廣
```

### 商業策略
```
圖片：
收益 = 權力券 + 討論區付費內容

影片：
收益 = VIP 訂閱（每日配額） + 未來永久欄位
流量 = 視覺吸引 → 帶動平台曝光
```

---

## ✅ 已實施功能

### 1. 基礎功能
- ✅ 影片上傳（R2 儲存）
- ✅ 影片播放（支援 MP4/WebM/MOV/AVI）
- ✅ 影片瀏覽（網格顯示）
- ✅ 影片 Modal（全螢幕播放）
- ✅ 縮圖預覽（Hover 播放 2 秒循環）
- ✅ 完整影片循環播放

### 2. 互動功能
- ✅ 點讚系統
- ✅ 追蹤作者
- ✅ 分享到個人頁面
- ✅ 編輯影片資訊
- ✅ 刪除影片（擁有者 + 管理員）

### 3. 元數據系統
- ✅ 基本資訊（標題、描述、標籤）
- ✅ AI 生成參數（平台、提示詞、技術參數）
- ✅ 自動提取（解析度、時長、FPS）
- ✅ 完整度評分
- ✅ 顯示所有可用元數據（無完整度門檻）

### 4. 排序系統
- ✅ 人氣排序（popScore）
- ✅ 新影片加成（initialBoost）
- ✅ 時間衰減

### 5. 個人頁面整合
- ✅ 上傳作品混合顯示（圖片 + 影片）
- ✅ 收藏混合顯示
- ✅ 按時間排序
- ✅ 視覺區分（影片有播放圖標）

### 6. 上傳限制（新增）⭐
- ✅ **每日上傳限制：5 部/天（VIP 15 部）**
- ✅ 配額顯示（Modal 頂部）
- ✅ 達到上限提示
- ✅ 自動每日重置

---

## 🔮 預留功能（未來實施）

### 1. 永久欄位系統
**預計實施：** 2-3 個月後（影片量 > 500）

```
機制：
├─ 影片上傳後設定 autoDeleteAt（30天後）
├─ 30天後判定互動（3讚或20觀看）
├─ 未達標 → 預定刪除（7天前通知）
└─ 可購買永久欄位保存（50點/個）

欄位上限：
├─ 普通用戶：300 個
└─ VIP 用戶：500 個

預留欄位：
✓ isPermanent: Boolean
✓ permanentAt: Date
✓ autoDeleteAt: Date
```

### 2. 內容生命週期管理
**預計實施：** 6-12 個月後（總內容 > 10,000）

```
機制：
├─ 低互動內容自動冷藏
├─ 用戶可釘選重要作品（防冷藏）
├─ 釘選槽位：等級制 + 購買 + VIP
└─ 歸檔和自動刪除極低價值內容

預留欄位：
✓ status: 'active' | 'cold' | 'archived'
✓ isPinned: Boolean
✓ isHighQuality: Boolean
✓ viewCount, lastInteractionAt
✓ coldAt, archivedAt
```

### 3. 釘選槽位系統
**預計實施：** 6-9 個月後（內容 > 5,000）

```
槽位分配：
├─ LV1-3: 1 個
├─ LV4-6: 3 個
├─ LV7-9: 5 個
├─ LV10: 10 個
└─ VIP: +20 個

購買擴充：
├─ +1 欄位 = 100 點
├─ +5 欄位 = 400 點
└─ +10 欄位 = 700 點

預留欄位：
✓ User.pinnedContentSlots
✓ User.purchasedPinnedSlots
```

---

## 📊 當前限制總覽

| 類型 | 限制方式 | 普通用戶 | VIP 用戶 | 狀態 |
|------|---------|---------|---------|------|
| **每日上傳** | 5 部/天 | 5 部 | 15 部 | ✅ 已實施 |
| **總量上傳** | - | 無限制 | 無限制 | ⏸️ 未實施 |
| **永久欄位** | 30天刪除 | 0 個 | 0 個 | 🔮 預留 |
| **內容釘選** | 防冷藏 | 1 個 | 21 個 | 🔮 預留 |

---

## 🎨 UI/UX 完整流程

### 上傳流程
```
1. 點擊"上傳影片"按鈕
   ↓
2. 選擇分級（全年齡 / 15+ / 18+）
   ↓
3. 上傳檔案 + 填寫資訊
   - 顯示每日配額：3 / 5 部
   ↓
4. 檢查配額
   - 如果已達上限 → 提示錯誤
   - 如果未達上限 → 繼續上傳
   ↓
5. 上傳成功
   - 提示：今日剩餘 2/5
   - 跳轉到影片頁面
```

### 觀看流程
```
1. 影片網格顯示
   - Hover → 播放前 2 秒循環
   - 顯示時長、播放圖標
   ↓
2. 點擊打開 Modal
   - 完整影片循環播放
   - 顯示作者資訊、追蹤按鈕
   - 右側顯示完整資訊
   ↓
3. 互動
   - 點讚（播放器右下角）
   - 點擊頭像 → 跳轉作者頁面
   - 編輯/刪除（擁有者）
```

---

## 🔧 技術架構

### Model 層級
```
Video Model:
├─ 基本資訊（title, description, tags）
├─ 檔案資訊（videoUrl, duration, resolution）
├─ 作者資訊（author, authorName, authorAvatar）
├─ 互動數據（likes, views, clicks）
├─ AI 元數據（platform, prompt, fps, steps...）
├─ 分級分類（rating, category）
├─ 排序相關（popScore, initialBoost）
└─ 生命週期（status, isPinned, viewCount...）✨

User Model:
├─ ... 原有欄位
├─ dailyVideoUploads ✨
├─ lastVideoUploadDate ✨
├─ dailyVideoLimit ✨
├─ pinnedContentSlots 🔮
└─ purchasedPinnedSlots 🔮
```

### API 端點
```
影片相關：
✓ POST   /api/videos/upload          - 上傳影片
✓ GET    /api/videos                 - 獲取影片列表
✓ GET    /api/videos/[id]            - 獲取單個影片
✓ PUT    /api/videos/[id]/edit       - 編輯影片
✓ DELETE /api/videos/[id]/delete     - 刪除影片
✓ POST   /api/videos/[id]/like       - 切換點讚

用戶相關：
✓ GET    /api/user-videos            - 用戶上傳的影片
✓ GET    /api/user-liked-videos      - 用戶收藏的影片
✓ GET    /api/user/daily-video-quota - 每日配額查詢 ✨

未來端點（預留）：
🔮 POST   /api/videos/[id]/make-permanent  - 使用永久欄位
🔮 POST   /api/content/pin                 - 釘選內容
🔮 DELETE /api/content/pin                 - 取消釘選
🔮 POST   /api/store/buy-pinned-slots      - 購買釘選槽位
🔮 POST   /api/store/buy-permanent-slots   - 購買永久欄位
```

---

## 📖 相關文檔

- `CONTENT_LIFECYCLE_DESIGN.md` - 完整生命週期系統設計
- `PINNED_CONTENT_IMPLEMENTATION.md` - 釘選系統實施指南
- `DAILY_VIDEO_UPLOAD_LIMIT.md` - 每日上傳限制（本文檔）

---

## 🎯 下一步計畫

### 短期（1-2週）
- [ ] 監控每日上傳數據
- [ ] 收集用戶反饋
- [ ] 觀察 VIP 轉化率

### 中期（2-3個月）
- [ ] 當影片量 > 500，實施永久欄位系統
- [ ] 開發 30 天刪除機制
- [ ] 開發通知系統

### 長期（6-12個月）
- [ ] 當內容量 > 5,000，實施釘選系統
- [ ] 當內容量 > 10,000，實施冷藏機制
- [ ] 優化推薦演算法

---

**影片系統已完成基礎建設，並為未來成長做好充分準備！** 🚀✨



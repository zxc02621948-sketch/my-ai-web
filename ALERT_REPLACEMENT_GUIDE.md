# Alert() 替換為自定義彈窗指南

## ✅ 已完成的替換

### 核心組件
1. **全局通知管理器** - `components/common/GlobalNotificationManager.jsx`
2. **通知彈窗組件** - `components/common/NotificationModal.jsx`
3. **根佈局整合** - `app/layout.js`

### 已替換的頁面
1. ✅ **商店頁面** (`app/store/page.jsx`) - 所有購買提示
   - 播放清單擴充成功/失敗
   - 訂閱成功/失敗
   - 頭像框購買成功/失敗
   - 權力券購買成功/失敗
   - 播放器造型購買成功/失敗

2. ✅ **播放器頁面** (`app/user/[id]/player/page.jsx`)
   - 播放清單提示

3. ✅ **用戶編輯** (`components/user/UserEditModal.jsx`)
   - 更新失敗提示

## 📝 使用方法

### 1. 導入通知函數
```javascript
import { notify } from "@/components/common/GlobalNotificationManager";
```

### 2. 替換 alert()

#### 成功消息
```javascript
// 舊的
alert("購買成功！");

// 新的
notify.success("購買成功！", "詳細說明內容...");
```

#### 錯誤消息
```javascript
// 舊的
alert("購買失敗");

// 新的
notify.error("購買失敗", "錯誤詳情...");
```

#### 警告消息
```javascript
// 舊的
alert("請先登入");

// 新的
notify.warning("提示", "請先登入");
```

#### 信息消息
```javascript
// 舊的
alert("操作完成");

// 新的
notify.info("提示", "操作完成");
```

### 3. 進階用法

#### 自動關閉
```javascript
notify.success("操作成功", "此消息將在 3 秒後自動關閉", {
  autoClose: true,
  autoCloseDelay: 3000
});
```

## 🔄 待替換的文件

以下文件仍使用 `alert()`，建議逐步替換：

1. `app/settings/page.jsx` - 2 個 alert
2. `components/user/UserHeader.jsx` - 5 個 alert
3. `components/common/MiniPlayer.jsx` - 1 個 alert
4. `components/user/UnifiedAvatarModal.jsx` - 1 個 alert
5. `app/discussion/page.jsx` - 7 個 alert
6. `app/page.js` - 2 個 alert
7. `components/player/PinPlayerButton.jsx` - 4 個 alert
8. `components/upload/UploadStep2.jsx` - 多個 alert

## 🎨 彈窗樣式

- **Success (成功)**: 綠色邊框，✅ 圖標
- **Error (錯誤)**: 紅色邊框，❌ 圖標
- **Warning (警告)**: 黃色邊框，⚠️ 圖標
- **Info (信息)**: 藍色邊框，ℹ️ 圖標

## 🚀 優勢

1. **美觀統一** - 與網站整體風格一致的深色主題
2. **更好的用戶體驗** - 不阻塞瀏覽器操作
3. **自定義性強** - 支持自動關閉、多種類型
4. **響應式設計** - 在移動設備上也能良好顯示
5. **易於擴展** - 可以輕鬆添加新功能（如按鈕、鏈接等）

## 📌 注意事項

1. 所有新功能請使用 `notify.*` 而不是 `alert()`
2. 保持標題簡潔（1-3 個字），詳細內容放在消息參數中
3. 根據消息類型選擇合適的方法（success/error/warning/info）
4. 對於需要用戶確認的操作，仍然建議使用 `confirm()` 或自定義確認對話框


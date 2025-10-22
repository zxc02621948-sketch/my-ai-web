# 內容釘選系統實施指南

> **快速參考文件**：當需要實施釘選功能時的完整步驟

---

## 🎯 釘選槽位計算邏輯

### 完整公式
```javascript
總釘選位 = 基礎槽位（等級） + 購買槽位 + VIP 加成

// utils/contentLifecycle.js 已提供
export function getTotalPinnedSlots(user) {
  // 基礎槽位
  let base = 1;
  if (user.level >= 10) base = 10;
  else if (user.level >= 7) base = 5;
  else if (user.level >= 4) base = 3;
  
  // 購買槽位
  const purchased = user.purchasedPinnedSlots || 0;
  
  // VIP 加成
  const hasVIP = user.subscriptions?.some(
    sub => sub.isActive && sub.expiresAt > new Date()
  );
  const vipBonus = hasVIP ? 20 : 0;
  
  return base + purchased + vipBonus;
}
```

---

## 🛍️ 商城購買 API

### 創建文件：`app/api/store/buy-pinned-slots/route.js`

```javascript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

const noStore = { headers: { "Cache-Control": "no-store" } };

// 價格表
const PRICES = {
  1: 100,   // 單個
  5: 400,   // 5個包（8折）
  10: 700   // 10個包（7折）
};

const MAX_PURCHASE = 30; // 最多購買 30 個

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未登入" },
        { status: 401, ...noStore }
      );
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return NextResponse.json(
        { error: "找不到用戶" },
        { status: 404, ...noStore }
      );
    }

    const { quantity } = await req.json();
    
    // 驗證數量
    if (![1, 5, 10].includes(quantity)) {
      return NextResponse.json(
        { error: "無效的購買數量" },
        { status: 400, ...noStore }
      );
    }

    const cost = PRICES[quantity];

    // 檢查點數
    if (user.pointsBalance < cost) {
      return NextResponse.json(
        { error: `點數不足，需要 ${cost} 點` },
        { status: 400, ...noStore }
      );
    }

    // 檢查購買上限
    const currentPurchased = user.purchasedPinnedSlots || 0;
    if (currentPurchased + quantity > MAX_PURCHASE) {
      return NextResponse.json(
        { error: `最多只能購買 ${MAX_PURCHASE} 個釘選位` },
        { status: 400, ...noStore }
      );
    }

    // 扣除點數
    user.pointsBalance -= cost;
    user.purchasedPinnedSlots = currentPurchased + quantity;

    await user.save();

    return NextResponse.json({
      success: true,
      message: `成功購買 ${quantity} 個釘選位`,
      purchasedSlots: user.purchasedPinnedSlots,
      remainingPoints: user.pointsBalance,
      cost
    }, { status: 200, ...noStore });

  } catch (error) {
    console.error("[buy-pinned-slots] Error:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}
```

---

## 📌 釘選/取消釘選 API

### 創建文件：`app/api/content/pin/route.js`

```javascript
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import Video from "@/models/Video";
import { getTotalPinnedSlots } from "@/utils/contentLifecycle";

const noStore = { headers: { "Cache-Control": "no-store" } };

// 釘選內容
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未登入" },
        { status: 401, ...noStore }
      );
    }

    await dbConnect();
    const user = await User.findById(session.user.id);
    
    const { contentId, contentType } = await req.json();
    
    if (!['image', 'video'].includes(contentType)) {
      return NextResponse.json(
        { error: "無效的內容類型" },
        { status: 400, ...noStore }
      );
    }

    const Model = contentType === 'image' ? Image : Video;
    const content = await Model.findById(contentId);

    if (!content) {
      return NextResponse.json(
        { error: "找不到內容" },
        { status: 404, ...noStore }
      );
    }

    // 檢查權限（只能釘選自己的內容）
    const ownerId = contentType === 'image' 
      ? String(content.userId || content.user)
      : String(content.author);
    
    if (ownerId !== String(session.user.id)) {
      return NextResponse.json(
        { error: "只能釘選自己的內容" },
        { status: 403, ...noStore }
      );
    }

    // 檢查是否已釘選
    if (content.isPinned) {
      return NextResponse.json(
        { error: "此內容已釘選" },
        { status: 400, ...noStore }
      );
    }

    // 計算已釘選數量
    const pinnedImages = await Image.countDocuments({ 
      userId: session.user.id, 
      isPinned: true 
    });
    const pinnedVideos = await Video.countDocuments({ 
      author: session.user.id, 
      isPinned: true 
    });
    const currentPinned = pinnedImages + pinnedVideos;

    // 檢查是否超過上限
    const limit = getTotalPinnedSlots(user);
    if (currentPinned >= limit) {
      return NextResponse.json(
        { error: `已達釘選上限（${limit}個）`, currentPinned, limit },
        { status: 400, ...noStore }
      );
    }

    // 執行釘選
    content.isPinned = true;
    content.pinnedAt = new Date();
    await content.save();

    return NextResponse.json({
      success: true,
      message: "釘選成功",
      pinnedCount: currentPinned + 1,
      limit
    }, { status: 200, ...noStore });

  } catch (error) {
    console.error("[pin-content] Error:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}

// 取消釘選
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未登入" },
        { status: 401, ...noStore }
      );
    }

    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const contentId = searchParams.get('id');
    const contentType = searchParams.get('type');

    const Model = contentType === 'image' ? Image : Video;
    const content = await Model.findById(contentId);

    if (!content) {
      return NextResponse.json(
        { error: "找不到內容" },
        { status: 404, ...noStore }
      );
    }

    // 檢查權限
    const ownerId = contentType === 'image' 
      ? String(content.userId || content.user)
      : String(content.author);
    
    if (ownerId !== String(session.user.id)) {
      return NextResponse.json(
        { error: "只能取消釘選自己的內容" },
        { status: 403, ...noStore }
      );
    }

    // 取消釘選
    content.isPinned = false;
    content.pinnedAt = null;
    await content.save();

    // 計算剩餘釘選數
    const pinnedImages = await Image.countDocuments({ 
      userId: session.user.id, 
      isPinned: true 
    });
    const pinnedVideos = await Video.countDocuments({ 
      author: session.user.id, 
      isPinned: true 
    });

    return NextResponse.json({
      success: true,
      message: "取消釘選成功",
      pinnedCount: pinnedImages + pinnedVideos
    }, { status: 200, ...noStore });

  } catch (error) {
    console.error("[unpin-content] Error:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}
```

---

## 🎨 UI 組件範例

### 釘選按鈕組件：`components/content/PinButton.jsx`

```javascript
'use client';

import { useState } from 'react';
import { Pin, PinOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PinButton({ content, contentType, isPinned, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned] = useState(isPinned);

  const handleTogglePin = async () => {
    setLoading(true);
    
    try {
      if (pinned) {
        // 取消釘選
        const response = await fetch(
          `/api/content/pin?id=${content._id}&type=${contentType}`,
          { method: 'DELETE' }
        );
        
        const data = await response.json();
        
        if (response.ok) {
          setPinned(false);
          toast.success('✅ 已取消釘選');
          onUpdate?.(false);
        } else {
          toast.error(`❌ ${data.error}`);
        }
      } else {
        // 釘選
        const response = await fetch('/api/content/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contentId: content._id, 
            contentType 
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setPinned(true);
          toast.success(`✅ 已釘選（${data.pinnedCount}/${data.limit}）`);
          onUpdate?.(true);
        } else {
          toast.error(`❌ ${data.error}`);
        }
      }
    } catch (error) {
      console.error('釘選操作失敗:', error);
      toast.error('❌ 操作失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleTogglePin}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        pinned 
          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
          : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
      } disabled:opacity-50`}
      title={pinned ? "取消釘選" : "釘選此作品"}
    >
      {pinned ? <Pin size={16} className="fill-current" /> : <PinOff size={16} />}
      <span>{pinned ? '已釘選' : '釘選'}</span>
    </button>
  );
}
```

---

## 📱 釘選管理頁面範例

### 個人頁面添加釘選標籤：`app/user/[id]/page.jsx`

```javascript
// 新增 tab
const tabs = ['uploads', 'likes', 'pinned'];

// 釘選內容 tab
{activeTab === 'pinned' && (
  <div className="space-y-4">
    {/* 釘選槽位資訊 */}
    <div className="bg-zinc-800 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-medium">📌 我的釘選作品</h3>
        <span className="text-gray-400 text-sm">
          {pinnedCount} / {pinnedLimit} 個
        </span>
      </div>
      
      {/* 進度條 */}
      <div className="w-full bg-zinc-700 rounded-full h-2 mb-3">
        <div 
          className="bg-yellow-500 h-2 rounded-full transition-all"
          style={{ width: `${(pinnedCount / pinnedLimit) * 100}%` }}
        />
      </div>

      {/* 提示 */}
      {pinnedCount < pinnedLimit ? (
        <p className="text-gray-400 text-sm">
          💡 還可以釘選 {pinnedLimit - pinnedCount} 個作品
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-yellow-400 text-sm">
            ⚠️ 釘選位已滿
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => router.push('/store')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
            >
              購買更多釘選位
            </button>
          </div>
        </div>
      )}
    </div>

    {/* 釘選的內容網格 */}
    <ImageGrid
      images={pinnedContent}
      currentUser={currentUser}
      onSelectImage={handleSelectImage}
      showPinBadge={true}
    />
  </div>
)}
```

---

## 🏪 商城新增項目

### 更新：`app/store/page.jsx`

```javascript
// 內容管理分類
{
  id: 'content-management',
  name: '內容管理',
  items: [
    {
      id: 'pin-slot-1',
      name: '+1 釘選位（永久）',
      description: '增加 1 個內容釘選位，永久有效',
      price: 100,
      icon: '📌',
      badge: null,
      action: async () => {
        const response = await fetch('/api/store/buy-pinned-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: 1 })
        });
        const data = await response.json();
        if (data.success) {
          toast.success(`✅ ${data.message}`);
          // 刷新用戶資料
        } else {
          toast.error(`❌ ${data.error}`);
        }
      }
    },
    {
      id: 'pin-slot-5',
      name: '+5 釘選位包（永久）',
      description: '增加 5 個內容釘選位，永久有效',
      price: 400,
      icon: '📌',
      badge: '省100點',
      action: async () => {
        // 同上，quantity: 5
      }
    },
    {
      id: 'pin-slot-10',
      name: '+10 釘選位包（永久）',
      description: '增加 10 個內容釘選位，永久有效',
      price: 700,
      icon: '📌',
      badge: '省300點',
      action: async () => {
        // 同上，quantity: 10
      }
    }
  ]
}
```

---

## 🔍 查詢過濾邏輯

### API 查詢時過濾冷藏內容

```javascript
// app/api/images/route.js
// app/api/videos/route.js

// 修改查詢條件
const query = {
  rating: { $in: allowedRatings },
  status: 'active', // ✨ 只查詢活躍內容
};

// 或提供選項顯示冷藏內容
const includeCold = searchParams.get('includeCold') === 'true';
if (!includeCold) {
  query.status = 'active';
}
```

---

## 📊 統計 API

### 創建文件：`app/api/user/content-stats/route.js`

```javascript
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  
  const [
    totalImages,
    totalVideos,
    pinnedImages,
    pinnedVideos,
    coldImages,
    coldVideos
  ] = await Promise.all([
    Image.countDocuments({ userId }),
    Video.countDocuments({ author: userId }),
    Image.countDocuments({ userId, isPinned: true }),
    Video.countDocuments({ author: userId, isPinned: true }),
    Image.countDocuments({ userId, status: 'cold' }),
    Video.countDocuments({ author: userId, status: 'cold' })
  ]);

  const user = await User.findById(userId);
  const pinnedLimit = getTotalPinnedSlots(user);
  const videoLimit = getVideoUploadLimit(user.level, hasVIP);

  return NextResponse.json({
    images: { total: totalImages, pinned: pinnedImages, cold: coldImages },
    videos: { total: totalVideos, pinned: pinnedVideos, cold: coldVideos },
    limits: {
      pinnedSlots: { used: pinnedImages + pinnedVideos, total: pinnedLimit },
      videoUploads: { used: totalVideos, total: videoLimit }
    }
  });
}
```

---

## ⚙️ 定時任務範例

### 創建文件：`scripts/cold-storage-task.js`

```javascript
// 每日凌晨 2:00 執行

import { dbConnect } from '@/lib/db';
import Image from '@/models/Image';
import Video from '@/models/Video';
import { shouldColdImage, shouldColdVideo } from '@/utils/contentLifecycle';

async function runColdStorageTask() {
  await dbConnect();
  
  const now = new Date();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const oneEightyDaysAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
  const oneTwentyDaysAgo = new Date(now - 120 * 24 * 60 * 60 * 1000);

  // 找出應該冷藏的影片
  const videosToCold = await Video.find({
    status: 'active',
    createdAt: { $lt: ninetyDaysAgo },
    likesCount: { $lt: 5 },
    viewCount: { $lt: 50 },
    lastInteractionAt: { $lt: sixtyDaysAgo },
    isPinned: false,
    isHighQuality: false,
    forceActive: false
  });

  // 找出應該冷藏的圖片
  const imagesToCold = await Image.find({
    status: 'active',
    createdAt: { $lt: oneEightyDaysAgo },
    likesCount: { $lt: 3 },
    viewCount: { $lt: 30 },
    completenessScore: { $lt: 30 },
    lastInteractionAt: { $lt: oneTwentyDaysAgo },
    isPinned: false,
    isHighQuality: false,
    forceActive: false
  });

  // 批次更新
  if (videosToCold.length > 0) {
    await Video.updateMany(
      { _id: { $in: videosToCold.map(v => v._id) } },
      { status: 'cold', coldAt: now }
    );
    console.log(`✅ ${videosToCold.length} 部影片已冷藏`);
  }

  if (imagesToCold.length > 0) {
    await Image.updateMany(
      { _id: { $in: imagesToCold.map(i => i._id) } },
      { status: 'cold', coldAt: now }
    );
    console.log(`✅ ${imagesToCold.length} 張圖片已冷藏`);
  }

  console.log('🧊 冷藏任務執行完成');
}

// 使用 node-cron 或其他排程工具執行
// cron.schedule('0 2 * * *', runColdStorageTask);

export default runColdStorageTask;
```

---

## 📝 UI 文案參考

### 釘選相關文案
```
按鈕文案：
- "📌 釘選此作品"
- "✅ 已釘選"
- "📌 管理釘選"

提示文案：
- "釘選可永久保護作品不被冷藏"
- "你還有 X 個釘選位可用"
- "已達釘選上限，購買更多釘選位或取消現有釘選"

成功提示：
- "✅ 釘選成功 (8/10)"
- "✅ 已取消釘選"

錯誤提示：
- "❌ 已達釘選上限（10個）"
- "❌ 只能釘選自己的內容"
```

### 冷藏相關文案
```
警告通知：
"⚠️ 你有 5 部影片可能即將被冷藏
 這些影片上傳超過 85 天且互動較少
 釘選可永久保護它們"

狀態標籤：
- "🧊 已冷藏"
- "📦 已歸檔"

恢復提示：
"此內容已被冷藏，點擊可恢復為活躍狀態"
```

---

## 🎯 實施檢查清單

### 開始實施前確認

- [ ] 內容總量是否 > 目標值
- [ ] 儲存成本是否成為問題
- [ ] 用戶是否反應內容質量下降
- [ ] 是否有足夠的互動數據

### 實施步驟

1. **Phase 1: 互動追蹤**
   - [ ] 開發觀看計數 API
   - [ ] 更新 lastInteractionAt 邏輯
   - [ ] 測試數據收集準確性

2. **Phase 2: 釘選功能**
   - [ ] 開發釘選 API
   - [ ] 開發釘選 UI 組件
   - [ ] 開發商城購買功能
   - [ ] 測試槽位計算邏輯

3. **Phase 3: 冷藏機制**
   - [ ] 開發定時任務
   - [ ] 測試冷藏判定邏輯
   - [ ] 實施查詢過濾
   - [ ] 用戶通知系統

4. **Phase 4: 歸檔機制**
   - [ ] 開發歸檔掃描
   - [ ] 實施自動刪除
   - [ ] 建立申訴機制
   - [ ] 監控系統運作

---

**此文檔將在實施時持續更新**


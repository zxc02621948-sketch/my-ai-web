export const STORE_PRODUCTS = {
  features: [
    {
      id: "player-1day-coupon",
      title: "播放器 1 日免費體驗券",
      description: "體驗個人頁面專屬播放器功能，支援播放列表、音量控制等功能。讓音樂陪伴創作的每一刻！",
      icon: "/store/mini-player.png",
      price: 0,
      originalPrice: 0,
      isLimited: true,
      expiry: 1, // 1天有效期
      category: "features",
      type: "player-coupon",
      duration: 1,
      maxPurchase: 1, // 終身限購1次
      features: [
        "個人頁面專屬播放器",
        "支援播放列表功能",
        "音量即時控制",
        "體驗期限 1 天",
        "終身限購 1 次"
      ]
    },
    {
      id: "pin-player-subscription",
      title: "釘選播放器（月租）",
      description: "全站播放你喜歡的音樂！釘選後在任何頁面都能持續播放，讓音樂陪你瀏覽整個網站。",
      icon: "📌",
      price: 200,
      originalPrice: 300,
      isLimited: false,
      expiry: null,
      category: "features",
      type: "subscription", // 月租類型
      billingCycle: "monthly", // 每月
      features: [
        "全站跨頁面播放",
        "30 天有效期",
        "累積制續費",
        "到期前 3 天提醒",
        "每月 200 積分"
      ]
    },
    {
      id: "playlist-expansion",
      title: "播放清單擴充",
      description: "增加播放清單容量，存放更多你喜愛的歌曲！每次擴充增加不同數量，價格隨次數遞增。",
      icon: "📜",
      price: "動態", // 動態價格
      originalPrice: null,
      isLimited: false,
      expiry: null,
      category: "features",
      type: "playlist-expansion",
      features: [
        "第 1 次：+5 首（10 首）→ 50 積分",
        "第 2 次：+5 首（15 首）→ 100 積分",
        "第 3 次：+5 首（20 首）→ 200 積分",
        "第 4 次：+10 首（30 首）→ 400 積分",
        "第 5 次：+10 首（40 首）→ 600 積分",
        "第 6 次：+10 首（50 首）→ 800 積分",
        "永久有效，可重複購買至上限"
      ]
    }
    // 調色盤功能已改為 LV2 等級獎勵，不再於商店販售
  ],
  personalization: [
    {
      id: "premium-player-skin",
      title: "高階播放器造型 - 貓咪耳機",
      description: "超酷的貓咪耳機造型搭配 RGB 流光動畫！可自定義顏色、速度、亮度，讓你的播放器獨一無二！",
      icon: "/cat-headphone.png",
      price: 500,
      originalPrice: 800,
      isLimited: false,
      expiry: null,
      category: "personalization",
      type: "premium-skin",
      features: [
        "🐱 可愛貓咪耳機造型",
        "🌈 RGB 流光動畫效果",
        "🎨 完全自定義顏色設定",
        "⚡ 可調整流動速度",
        "✨ 純色/漸變多種模式",
        "💎 全局生效（所有頁面）",
        "♾️ 永久使用權"
      ]
    },
    {
      id: "ai-generated-frame",
      title: "AI 生成頭像框",
      description: "AI 生成的藝術頭像框，展現科技與藝術的完美結合",
      icon: "/frames/ai-generated-7899315_1280.png",
      price: 300,
      originalPrice: 500,
      isLimited: false,
      expiry: null,
      category: "personalization",
      features: [
        "AI 生成藝術風格",
        "獨特設計元素",
        "永久使用權"
      ]
    },
    {
      id: "animals-frame",
      title: "動物頭像框",
      description: "可愛的動物主題頭像框，展現你的個性與喜好",
      icon: "/frames/animals-5985896_1280.png",
      price: 200,
      originalPrice: 350,
      isLimited: false,
      expiry: null,
      category: "personalization",
      features: [
        "動物主題設計",
        "可愛風格",
        "永久使用權"
      ]
    },
    {
      id: "magic-circle-frame",
      title: "魔法陣頭像框",
      description: "神秘的魔法陣設計頭像框，展現你的魔法師身份",
      icon: "/frames/魔法陣1.png",
      price: 300,
      originalPrice: 450,
      isLimited: false,
      expiry: null,
      category: "personalization",
      features: [
        "魔法陣主題設計",
        "神秘風格",
        "永久使用權"
      ]
    },
    {
      id: "magic-circle-2-frame",
      title: "魔法陣2頭像框（測試版）",
      description: "測試版魔法陣設計，未來將升級為高級版本！早鳥價限時優惠，升級後不再以此價格販售。",
      icon: "/frames/魔法陣2.png",
      price: 300,
      originalPrice: 600,
      isLimited: false,
      expiry: null,
      category: "personalization",
      features: [
        "測試版設計",
        "未來將升級為高級版",
        "早鳥投資機會",
        "永久使用權"
      ]
    }
  ],
  special: [
    {
      id: "power-coupon-7day",
      title: "新圖加乘權力券 (7天)",
      description: "讓指定圖片重新獲得新圖加乘效果，券有效期7天，使用後效果持續10小時",
      icon: "🎫",
      price: 30,
      originalPrice: 50,
      isLimited: true,
      expiry: null,
      category: "special",
      type: "power-coupon",
      duration: 7,
      features: [
        "重新獲得新圖加乘",
        "券有效期7天",
        "效果持續10小時",
        "針對特定圖片",
        "限時優惠價格"
      ]
    },
    {
      id: "power-coupon-30day",
      title: "新圖加乘權力券 (30天)",
      description: "讓指定圖片重新獲得新圖加乘效果，券有效期30天，使用後效果持續10小時",
      icon: "🎫",
      price: 100,
      originalPrice: 150,
      isLimited: true,
      expiry: null,
      category: "special",
      type: "power-coupon",
      duration: 30,
      features: [
        "重新獲得新圖加乘",
        "券有效期30天",
        "效果持續10小時",
        "針對特定圖片",
        "長期投資優惠"
      ]
    }
  ],
  limited: [
    // 限時商品分類（目前暫無商品）
  ]
};
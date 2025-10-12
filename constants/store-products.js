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
      id: "frame-color-editor",
      title: "頭像框調色盤",
      description: "解鎖頭像框顏色編輯功能，讓你的頭像框更加個性化！",
      icon: "/store/color-palette.svg",
      price: 0,
      originalPrice: 200,
      isLimited: false,
      expiry: null,
      category: "features",
      features: [
        "12 種預設顏色快速選擇",
        "自訂顏色選擇器",
        "濾鏡強度控制",
        "即時預覽效果",
        "永久解鎖使用"
      ]
    }
    // 其他功能解鎖商品...
  ],
  personalization: [
    {
      id: "ai-generated-frame",
      title: "AI 生成頭像框",
      description: "AI 生成的藝術頭像框，展現科技與藝術的完美結合",
      icon: "/frames/ai-generated-7899315_1280.png",
      price: 0,
      originalPrice: 50,
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
      price: 0,
      originalPrice: 30,
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
      price: 0,
      originalPrice: 40,
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
      title: "魔法陣2頭像框",
      description: "進階版魔法陣設計頭像框，更華麗的魔法效果",
      icon: "/frames/魔法陣2.png",
      price: 0,
      originalPrice: 50,
      isLimited: false,
      expiry: null,
      category: "personalization",
      features: [
        "進階魔法陣設計",
        "華麗魔法效果",
        "永久使用權"
      ]
    }
  ],
  premium: [
    // 曝光分數是訂閱專屬，不在商店販售
  ],
  limited: [
    {
      id: "power-coupon-7day",
      title: "新圖加乘權力券 (7天)",
      description: "讓指定圖片重新獲得新圖加乘效果，持續7天",
      icon: "🎫",
      price: 30,
      originalPrice: 50,
      isLimited: true,
      expiry: null,
      category: "limited",
      type: "power-coupon",
      duration: 7,
      features: [
        "重新獲得新圖加乘",
        "持續7天",
        "針對特定圖片",
        "3天限購1張"
      ]
    },
    {
      id: "power-coupon-30day",
      title: "新圖加乘權力券 (30天)",
      description: "讓指定圖片重新獲得新圖加乘效果，持續30天",
      icon: "🎫",
      price: 100,
      originalPrice: 150,
      isLimited: true,
      expiry: null,
      category: "limited",
      type: "power-coupon",
      duration: 30,
      features: [
        "重新獲得新圖加乘",
        "持續30天",
        "針對特定圖片",
        "7天限購1張"
      ]
    }
  ]
};
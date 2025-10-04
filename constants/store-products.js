export const STORE_PRODUCTS = {
  features: [
    {
      id: "mini-player",
      title: "迷你播放器",
      description: "在個人頁面啟用專屬播放器，支援播放列表、音量控制等功能。讓音樂陪伴創作的每一刻！",
      icon: "/store/mini-player.png",
      price: 0,
      originalPrice: 100,
      isLimited: true,
      expiry: null, // 永久有效
      category: "features",
      features: [
        "個人頁面專屬播放器",
        "支援播放列表功能",
        "音量即時控制",
        "永久解鎖使用"
      ]
    }
    // 其他功能解鎖商品...
  ],
  personalization: [
    // 個性化商品...
  ],
  premium: [
    // 特權服務商品...
  ],
  limited: [
    // 限時特惠商品...
  ]
};
/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
        pathname: "/**", // 符合 Cloudflare Images 的通用路徑
      },
    ],
  },
  pageExtensions: ["js", "jsx", "ts", "tsx"],
  // 移除 IDE webview 的 Vite 代理重寫以避免開發時 vendor-chunks 載入錯誤
  // 如需再次啟用，請恢復下方設定
  // async rewrites() {
  //   return [
  //     {
  //       source: '/@vite/:path*',
  //       destination: '/api/vite-fallback', // 重定向到一個空的 API 端點
  //     },
  //   ];
  // },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;

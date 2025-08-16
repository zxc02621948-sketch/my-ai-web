/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  images: {
    domains: ["imagedelivery.net"],
  },
  // 確保 .jsx 也被解析（以防自訂過 pageExtensions）
  pageExtensions: ["js", "jsx", "ts", "tsx"],

  // 強化 alias：就算 jsconfig/tsconfig 沒被讀到，webpack 也能解析 "@"
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;

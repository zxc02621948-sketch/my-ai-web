"use client";
import { Toaster } from "react-hot-toast";

export default function ClientToaster() {
  // ✅ 注意：此组件已通过 dynamic import 的 ssr: false 选项确保只在客户端渲染
  // 因此不需要额外的 mounted 检查
  return (
    <Toaster 
      position="top-center"
      toastOptions={{
        style: {
          zIndex: 999999,  // 確保在所有 Modal 之上
        },
      }}
      containerStyle={{
        zIndex: 999999,  // 容器也需要高 z-index
      }}
    />
  );
}

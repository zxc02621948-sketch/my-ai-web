"use client";
import { Toaster } from "react-hot-toast";

export default function ClientToaster() {
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

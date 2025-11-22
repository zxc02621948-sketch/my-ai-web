"use client";

import { useEffect } from "react";
import { initStorageManager } from "@/utils/localStorageManager";

/**
 * 存储管理器初始化组件
 * 在应用启动时初始化 localStorage 管理器
 */
export default function StorageManagerInit() {
  useEffect(() => {
    // 初始化存储管理器
    initStorageManager();
  }, []);

  return null; // 不渲染任何内容
}


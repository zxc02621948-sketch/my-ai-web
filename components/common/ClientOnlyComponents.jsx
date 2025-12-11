"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// ✅ 使用动态导入，确保只在客户端渲染，避免 hydration mismatch
const ClientToaster = dynamic(
  () => import("@/components/common/ClientToaster").then(mod => ({ default: mod.default })),
  { ssr: false }
);

const AdFooterPlaceholder = dynamic(
  () => import("@/components/common/AdFooterPlaceholder").then(mod => ({ default: mod.default })),
  { ssr: false }
);

export default function ClientOnlyComponents() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <ClientToaster />
      <AdFooterPlaceholder />
    </>
  );
}


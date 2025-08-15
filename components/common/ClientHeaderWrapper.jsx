"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/common/Header";

export default function ClientHeaderWrapper({ currentUser, setCurrentUser }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);

  // 先吃首頁廣播來的建議字（如果有）
  useEffect(() => {
    const onSug = (e) => {
      const list = Array.isArray(e?.detail) ? e.detail : [];
      setSuggestions(list);
    };
    window.addEventListener("header-suggestions", onSug);
    return () => window.removeEventListener("header-suggestions", onSug);
  }, []);

  // 遠端建議是「可選」：只有回 JSON 才採用；否則靜默忽略（避免 Unexpected token '<'）
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/suggestions", {
          headers: { Accept: "application/json" },
        });
        const ctype = res.headers.get("content-type") || "";
        if (!res.ok || !ctype.includes("application/json")) return; // 非 JSON 就當作沒有
        const data = await res.json();
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];
        if (!canceled && arr.length) {
          const uniq = Array.from(
            new Set(arr.filter(Boolean).map((s) => String(s).trim()))
          ).slice(0, 100);
          // 合併：本地（廣播）優先，遠端補充
          setSuggestions((prev) =>
            Array.from(new Set([...(prev || []), ...uniq]))
          );
        }
      } catch {
        // 靜默忽略，不再噴錯到 console
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const handleSearch = (query) => {
    const q = (query || "").trim();
    if (!q) {
      router.push("/"); // 清空搜尋就回首頁
      return;
    }
    const encoded = encodeURIComponent(q);
    router.push(`/?search=${encoded}`); // ← 統一用 search
  };

  return (
    <Header
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      suggestions={suggestions}
      onSearch={handleSearch}
      onLogout={async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setCurrentUser(null);
        location.reload();
      }}
      onLoginOpen={() => window.dispatchEvent(new Event("openLoginModal"))}
      onRegisterOpen={() => window.dispatchEvent(new Event("openRegisterModal"))}
      onUploadClick={() => window.dispatchEvent(new Event("openUploadModal"))}
      onGuideClick={() => router.push("/install-guide")}
    />
  );
}

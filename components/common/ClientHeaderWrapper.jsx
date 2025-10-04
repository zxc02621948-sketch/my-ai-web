"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/common/Header";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function ClientHeaderWrapper({ currentUser, setCurrentUser }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);

  // 取得 Context（優先用 Context，props 作為退路）
  // 直接呼叫 Hook，避免可選鍊編譯成 .call 導致在某些情況下出現 undefined.reading('call') 錯誤
  const ctx = useCurrentUser();
  const ctxUser = ctx?.currentUser;
  const setCtxUser = ctx?.setCurrentUser;
  const effectiveUser = ctxUser || currentUser;
  const setUser = setCtxUser || setCurrentUser;

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

  // 取得 token（若存在）
  const getToken = () => {
    if (typeof document === "undefined") return null;
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1] || null;
  };

  // ✅ 登入後載入一次：靜默呼叫每日登入 API（支援 Cookie 與 Authorization）
  useEffect(() => {
    if (!effectiveUser?._id) return;
    let done = false;
    (async () => {
      try {
        if (done) return;
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch("/api/points/daily-login", { method: "POST", headers, credentials: "include" });
        // 之後無論每日登入是否加分，都抓取最新使用者資訊並廣播（避免個人頁面顯示舊值 0）
        try {
          const uid = effectiveUser?._id || effectiveUser?.id;
          const meRes = await fetch(`/api/user-info?id=${encodeURIComponent(uid)}`, {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
          });
          if (meRes.ok) {
            const me = await meRes.json().catch(() => null);
            if (me && me._id) {
              // 更新 currentUser（若有需要顯示）
              setUser?.((prev) => ({ ...(prev || {}), ...me }));
              // 廣播積分更新事件
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("points-updated", {
                    detail: { userId: me._id, pointsBalance: me.pointsBalance ?? 0 },
                  })
                );
              }
            }
          }
        } catch {}

        // 額外：若此次每日登入有加分，於控制台提示（可選）
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.ok && data?.added > 0) {
            // 簡化 log 避免效能問題
          }
        }
      } catch (e) {
        // 靜默處理
      } finally {
        done = true;
      }
    })();
  }, [effectiveUser?._id]);

  return (
    <Header
      currentUser={effectiveUser}
      setCurrentUser={setUser}
      suggestions={suggestions}
      onSearch={handleSearch}
      onLogout={async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setUser?.(null);
        location.reload();
      }}
      onLoginOpen={() => window.dispatchEvent(new Event("openLoginModal"))}
      onRegisterOpen={() => window.dispatchEvent(new Event("openRegisterModal"))}
      onUploadClick={() => window.dispatchEvent(new Event("openUploadModal"))}
      onGuideClick={() => router.push("/install-guide")}
    />
  );
}

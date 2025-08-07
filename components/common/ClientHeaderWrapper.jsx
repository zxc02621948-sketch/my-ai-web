"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/common/Header";

export default function ClientHeaderWrapper({ currentUser, setCurrentUser }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/suggestions");
        const data = await res.json();
        if (Array.isArray(data)) {
          const normalized = data
            .filter(Boolean)
            .map((s) => s.toString().toLowerCase().trim());
          setSuggestions(normalized);
        }
      } catch (err) {
        console.warn("取得建議詞失敗：", err);
      }
    };

    fetchSuggestions();
  }, []);

  const handleSearch = (query) => {
    const encoded = encodeURIComponent(query.trim());
    if (encoded) router.push(`/?q=${encoded}`);
  };

  return (
    <Header
      currentUser={currentUser}
      setCurrentUser={setCurrentUser}
      suggestions={suggestions}
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

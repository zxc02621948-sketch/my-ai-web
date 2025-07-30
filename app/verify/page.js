"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import SearchParamsVerify from "@/components/common/SearchParamsVerify";

export default function VerifyPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("loading");
  const router = useRouter();

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus("missing");
        return;
      }

      console.log("🎯 token：", token);

      const url = `${window.location.origin}/api/auth/verify?token=${token}`;
      console.log("🔗 驗證 API 呼叫：", url);

      try {
        const res = await fetch(url);
        if (res.ok) {
          setStatus("success");
          setTimeout(() => router.push("/verify-success"), 2000);
        } else {
          setStatus("failed");
        }
      } catch (err) {
        console.error("驗證錯誤：", err);
        setStatus("error");
      }
    };

    verifyToken();
  }, [token, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <Suspense fallback={null}>
        <SearchParamsVerify onTokenRead={setToken} />
      </Suspense>

      {status === "loading" && <p>⏳ 驗證中，請稍候...</p>}
      {status === "success" && <p>✅ 驗證成功！即將跳轉...</p>}
      {status === "failed" && <p>❌ 驗證失敗，請確認連結是否正確</p>}
      {status === "missing" && <p>⚠️ 無效的驗證連結</p>}
      {status === "error" && <p>🚫 發生錯誤，請稍後再試</p>}
    </main>
  );
}

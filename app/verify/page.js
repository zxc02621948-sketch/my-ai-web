// app/verify/page.js
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerifyPage() {
  const [status, setStatus] = useState("loading");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token");

      console.log("🎯 token：", token);

      if (!token) {
        setStatus("missing");
        return;
      }  

      const url = `${window.location.origin}/api/auth/verify?token=${token}`;

      // ✅ 再加這一行
      console.log("🔗 驗證 API 呼叫：", url);

      try {
        const res = await fetch(url); // ✅ 使用上面定義的變數
        if (res.ok) {
          setStatus("success");
          // ✅ 驗證成功後跳轉到 success 畫面
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
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      {status === "loading" && <p>⏳ 驗證中，請稍候...</p>}
      {status === "success" && <p>✅ 驗證成功！即將跳轉...</p>}
      {status === "failed" && <p>❌ 驗證失敗，請確認連結是否正確</p>}
      {status === "missing" && <p>⚠️ 無效的驗證連結</p>}
      {status === "error" && <p>🚫 發生錯誤，請稍後再試</p>}
    </main>
  );
}

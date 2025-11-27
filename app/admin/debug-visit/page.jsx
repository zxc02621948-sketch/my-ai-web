"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DebugVisitPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/debug/visit-test");
      const json = await res.json();
      setData(json.debug);
    } catch (err) {
      console.error("獲取數據失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  const testVisit = async () => {
    setTestResult({ status: "testing", message: "正在測試..." });
    try {
      // 清除 sessionStorage
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith("visit_logged_") || key === "last_visit_log_time") {
          sessionStorage.removeItem(key);
        }
      });

      // 等待 35 秒（超過後端 30 秒去重窗口）
      setTestResult({ status: "waiting", message: "等待 35 秒以繞過後端去重..." });
      await new Promise(resolve => setTimeout(resolve, 35000));

      // 發送測試訪問
      const response = await fetch("/api/log-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path: window.location.pathname }),
      });

      const result = await response.json();
      setTestResult({
        status: result.success ? "success" : "error",
        message: result.message || result.error,
        data: result
      });

      // 刷新數據
      setTimeout(fetchData, 1000);
    } catch (error) {
      setTestResult({
        status: "error",
        message: error.message
      });
    }
  };

  const clearSessionStorage = () => {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith("visit_logged_") || key === "last_visit_log_time") {
        sessionStorage.removeItem(key);
      }
    });
    setTestResult({ status: "success", message: "已清除 sessionStorage" });
  };

  if (loading) {
    return <div className="p-8 text-white">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <button
        onClick={() => router.back()}
        className="mb-4 px-4 py-2 bg-white text-black rounded hover:bg-gray-100"
      >
        ← 返回
      </button>

      <h1 className="text-2xl font-bold mb-6">🔍 訪問記錄調試工具</h1>

      <div className="space-y-6">
        {/* 當前用戶信息 */}
        <div className="bg-zinc-900 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">當前用戶信息</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(data?.currentUser, null, 2)}
          </pre>
        </div>

        {/* 今日統計 */}
        <div className="bg-zinc-900 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">今日統計</h2>
          <div className="space-y-1">
            <p>總訪問次數: <span className="font-bold">{data?.todayStats?.totalVisits || 0}</span></p>
            <p>獨立用戶數: <span className="font-bold">{data?.todayStats?.uniqueUsers || 0}</span></p>
          </div>
        </div>

        {/* 最近訪問記錄 */}
        <div className="bg-zinc-900 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">最近 1 小時訪問記錄（最多 20 條）</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data?.recentVisits?.map((visit, idx) => (
              <div key={idx} className="border-b border-zinc-700 pb-2 text-sm">
                <p><strong>路徑:</strong> {visit.path}</p>
                <p><strong>時間:</strong> {new Date(visit.createdAt).toLocaleString()}</p>
                <p><strong>用戶:</strong> {visit.userId}</p>
                <p><strong>IP:</strong> {visit.ip}</p>
                <p><strong>VisitID:</strong> {visit.visitId}</p>
              </div>
            ))}
            {(!data?.recentVisits || data.recentVisits.length === 0) && (
              <p className="text-zinc-400">沒有最近的訪問記錄</p>
            )}
          </div>
        </div>

        {/* 測試工具 */}
        <div className="bg-zinc-900 p-4 rounded">
          <h2 className="text-lg font-semibold mb-4">測試工具</h2>
          <div className="space-y-3">
            <button
              onClick={clearSessionStorage}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              清除 sessionStorage（前端去重）
            </button>
            <button
              onClick={testVisit}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              測試訪問記錄（等待 35 秒後發送）
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              刷新數據
            </button>
          </div>
          {testResult && (
            <div className={`mt-4 p-3 rounded ${
              testResult.status === "success" ? "bg-green-800" :
              testResult.status === "error" ? "bg-red-800" :
              testResult.status === "waiting" ? "bg-yellow-800" :
              "bg-zinc-800"
            }`}>
              <p><strong>狀態:</strong> {testResult.status}</p>
              <p><strong>訊息:</strong> {testResult.message}</p>
              {testResult.data && (
                <pre className="text-xs mt-2 overflow-auto">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* 說明 */}
        <div className="bg-zinc-900 p-4 rounded text-sm text-zinc-300">
          <h3 className="font-semibold mb-2">說明：</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>前端去重：使用 sessionStorage，硬刷新（Ctrl+Shift+R）會清除</li>
            <li>後端去重：30 秒內相同 path + IP + UserAgent + userId 不重複記錄</li>
            <li>後端額外檢查：5 秒內相同 IP 的任何訪問都不記錄</li>
            <li>測試訪問會等待 35 秒以繞過後端去重機制</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


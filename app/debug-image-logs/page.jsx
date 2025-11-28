"use client";

import { useEffect, useState } from "react";

export default function DebugImageLogsPage() {
  const [logs, setLogs] = useState({
    viewerLogs: [],
    finalLogs: [],
    loadLogs: [],
    errorLogs: [],
  });

  useEffect(() => {
    const loadLogs = () => {
      try {
        const viewerLogs = JSON.parse(localStorage.getItem('imageViewerLogs') || '[]');
        const finalLogs = JSON.parse(localStorage.getItem('imageViewerFinalLogs') || '[]');
        const loadLogs = JSON.parse(localStorage.getItem('imageLoadLogs') || '[]');
        const errorLogs = JSON.parse(localStorage.getItem('imageErrorLogs') || '[]');
        setLogs({ viewerLogs, finalLogs, loadLogs, errorLogs });
      } catch (e) {
        console.error("讀取日誌失敗:", e);
      }
    };

    loadLogs();
    const interval = setInterval(loadLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('imageViewerLogs');
    localStorage.removeItem('imageViewerFinalLogs');
    localStorage.removeItem('imageLoadLogs');
    localStorage.removeItem('imageErrorLogs');
    setLogs({ viewerLogs: [], finalLogs: [], loadLogs: [], errorLogs: [] });
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">圖片載入調試日誌</h1>
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            清除所有日誌
          </button>
        </div>

        <div className="space-y-6">
          {/* 原圖 URL 日誌 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              🖼️ 原圖 URL 選擇 ({logs.viewerLogs.length})
            </h2>
            <div className="bg-neutral-800 rounded p-4 space-y-2 max-h-60 overflow-y-auto">
              {logs.viewerLogs.length === 0 ? (
                <p className="text-neutral-400">暫無日誌</p>
              ) : (
                logs.viewerLogs.map((log, i) => (
                  <div key={i} className="text-sm border-b border-neutral-700 pb-2">
                    <div className="font-mono text-xs text-neutral-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div>圖片 ID: {log.imageId}</div>
                    <div className={log.isR2 ? "text-green-400" : "text-yellow-400"}>
                      {log.isR2 ? "✅ R2 原圖" : "⚠️ Cloudflare Images"}
                    </div>
                    <div className="text-xs break-all text-neutral-300">
                      {log.originalImageUrl}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 最終 URL 日誌 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              🎯 最終使用的 URL ({logs.finalLogs.length})
            </h2>
            <div className="bg-neutral-800 rounded p-4 space-y-2 max-h-60 overflow-y-auto">
              {logs.finalLogs.length === 0 ? (
                <p className="text-neutral-400">暫無日誌</p>
              ) : (
                logs.finalLogs.map((log, i) => (
                  <div key={i} className="text-sm border-b border-neutral-700 pb-2">
                    <div className="font-mono text-xs text-neutral-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div>圖片 ID: {log.imageId}</div>
                    <div className="text-xs break-all text-blue-400">
                      最終 URL: {log.finalUrl}
                    </div>
                    <div className="text-xs text-neutral-400">
                      有原圖 URL: {log.hasOriginalImageUrl ? "是" : "否"}
                    </div>
                    {log.originalImageUrl && (
                      <div className="text-xs break-all text-green-400">
                        原圖: {log.originalImageUrl}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 圖片載入日誌 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              ✅ 圖片載入成功 ({logs.loadLogs.length})
            </h2>
            <div className="bg-neutral-800 rounded p-4 space-y-2 max-h-60 overflow-y-auto">
              {logs.loadLogs.length === 0 ? (
                <p className="text-neutral-400">暫無日誌</p>
              ) : (
                logs.loadLogs.map((log, i) => (
                  <div key={i} className="text-sm border-b border-neutral-700 pb-2">
                    <div className="font-mono text-xs text-neutral-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div>圖片 ID: {log.imageId}</div>
                    <div className="text-xs break-all text-blue-400">
                      URL: {log.url}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <span className="text-neutral-400">原始尺寸:</span>
                        <span className="ml-2 text-green-400">
                          {log.naturalWidth} × {log.naturalHeight}px
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400">顯示尺寸:</span>
                        <span className="ml-2 text-yellow-400">
                          {log.displayedWidth} × {log.displayedHeight}px
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 錯誤日誌 */}
          {logs.errorLogs.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-3 text-red-400">
                ❌ 圖片載入失敗 ({logs.errorLogs.length})
              </h2>
              <div className="bg-neutral-800 rounded p-4 space-y-2 max-h-60 overflow-y-auto">
                {logs.errorLogs.map((log, i) => (
                  <div key={i} className="text-sm border-b border-neutral-700 pb-2 text-red-400">
                    <div className="font-mono text-xs text-neutral-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                    <div>圖片 ID: {log.imageId}</div>
                    <div className="text-xs break-all">{log.url}</div>
                    <div className="text-xs">{log.error}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";
import React, { useState } from 'react';

export default function TestStreamUploadPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      console.log(`Starting Stream upload: ${file.name} (${file.size} bytes)`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      formData.append('description', '測試 Stream 上傳');
      formData.append('category', 'general');
      formData.append('rating', 'sfw');

      console.log('Uploading to Stream API...');

      const response = await fetch('/api/videos/upload-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stream upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setProgress(100);
      setResult(result);
      console.log('Stream upload successful:', result);

    } catch (error) {
      console.error('Stream upload error:', error);
      setError(error.message);
      setResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">測試 Cloudflare Stream 上傳</h1>

        <div className="bg-zinc-900 p-6 rounded-lg shadow-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              選擇影片檔案
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-500 file:text-white
                hover:file:bg-blue-600"
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>上傳中...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-md">
              <h3 className="text-red-400 font-semibold mb-2">上傳失敗</h3>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-zinc-700 rounded-md">
              <h2 className="text-xl font-semibold text-white mb-2">上傳結果:</h2>
              <pre className="text-sm text-gray-200 whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/50 rounded-md">
            <h3 className="text-blue-400 font-semibold mb-2">Stream 上傳優勢</h3>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• 支援任意大小的影片檔案</li>
              <li>• 自動轉碼和優化</li>
              <li>• 自動生成播放連結</li>
              <li>• 無 Vercel 413 錯誤</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

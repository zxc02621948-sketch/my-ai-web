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
      console.log(`Starting direct Stream upload: ${file.name} (${file.size} bytes)`);

      // 直接上傳到 Cloudflare Stream（跳過 Vercel）
      const streamResult = await uploadDirectlyToStream(file);
      
      if (!streamResult.success) {
        throw new Error(streamResult.error);
      }

      console.log('Direct Stream upload successful:', streamResult);

      // 上傳完成後，調用我們的 API 保存記錄
      const saveResponse = await fetch('/api/videos/save-stream-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamResult.streamId,
          playbackUrl: streamResult.playbackUrl,
          title: file.name,
          description: '測試 Stream 上傳',
          category: 'general',
          rating: 'sfw',
        }),
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        throw new Error(`Save record failed: ${errorText}`);
      }

      const saveResult = await saveResponse.json();
      setProgress(100);
      setResult({
        streamUpload: streamResult,
        databaseRecord: saveResult,
      });
      console.log('Complete upload successful:', saveResult);

    } catch (error) {
      console.error('Stream upload error:', error);
      setError(error.message);
      setResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  // 直接上傳到 Cloudflare Stream 的函數
  const uploadDirectlyToStream = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      console.log('Uploading directly to Cloudflare Stream...');

      // 注意：這裡需要你填入實際的 Account ID 和 API Token
      // 為了測試，請將下面的值替換為你的實際值
      const ACCOUNT_ID = '5c6250a0576aa4ca0bb9cdf32be0bee1'; // 請替換為實際值
      const API_TOKEN = 'FDh62HwIzm31AhAY05nuaGfsF4B4z1q61onBT4-s'; // 請替換為實際值
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stream API error response:', errorData);
        throw new Error(`Stream API error: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Stream API success:', data);
      
      return {
        success: true,
        streamId: data.result.uid,
        playbackUrl: data.result.playback.hls,
      };
    } catch (error) {
      console.error('Direct Stream upload error:', error);
      return {
        success: false,
        error: error.message,
      };
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

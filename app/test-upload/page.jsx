"use client";
import { useState } from 'react';

export default function TestUploadPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // 先測試簡單的 API
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/test-simple', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Simple test failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setProgress(100);
      setResult(result);
      
    } catch (error) {
      console.error('Upload error:', error);
      setResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 py-10">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">測試分塊上傳</h1>
        
        <div className="bg-zinc-900 p-6 rounded-lg">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="mb-4"
          />
          
          {uploading && (
            <div className="space-y-2">
              <div className="text-sm text-gray-400">
                上傳進度: {Math.round(progress)}%
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          
          {result && (
            <div className="mt-4 p-4 bg-zinc-800 rounded">
              <h3 className="text-white font-semibold mb-2">上傳結果:</h3>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

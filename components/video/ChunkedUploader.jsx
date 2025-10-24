"use client";
import { useState, useRef } from 'react';

const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

export default function ChunkedUploader({ onUploadComplete, onUploadError }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const fileInputRef = useRef(null);

  const uploadFile = async (file) => {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    
    setUploading(true);
    setProgress(0);
    setCurrentChunk(0);
    setTotalChunks(chunks);

    try {
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', chunks);
        formData.append('fileName', file.name);
        formData.append('fileSize', file.size);
        formData.append('uploadId', uploadId);

        const response = await fetch('/api/videos/upload-chunk', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        setCurrentChunk(i + 1);
        setProgress((i + 1) / chunks * 100);

        if (result.completed) {
          // 所有塊都已上傳完成
          onUploadComplete?.(result);
          break;
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? '上傳中...' : '選擇影片檔案'}
        </button>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            上傳進度: {currentChunk}/{totalChunks} 塊
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-gray-600">
            {Math.round(progress)}% 完成
          </div>
        </div>
      )}
    </div>
  );
}

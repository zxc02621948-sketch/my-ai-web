'use client';

import { useState, useEffect } from 'react';

export default function YouTubeErrorToast() {
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleYouTubeError = (event) => {
      const { errorCode, videoId, message, youtubeUrl } = event.detail;
      setError({
        code: errorCode,
        videoId,
        message,
        youtubeUrl
      });
      setIsVisible(true);

      // 自動隱藏錯誤提示（5秒後）
      setTimeout(() => {
        setIsVisible(false);
        setError(null);
      }, 8000);
    };

    window.addEventListener('youtubeError', handleYouTubeError);
    return () => window.removeEventListener('youtubeError', handleYouTubeError);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setError(null);
  };

  const handleOpenYouTube = () => {
    if (error?.youtubeUrl) {
      window.open(error.youtubeUrl, '_blank');
    }
  };

  if (!isVisible || !error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-red-900 border border-red-700 rounded-lg shadow-lg p-4 animate-slide-up">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-200">
                  🎵 播放器錯誤
                </h3>
              </div>
            </div>
            
            <div className="text-sm text-red-300 mb-3">
              {error.message}
            </div>
            
            <div className="text-xs text-red-400 mb-3">
              錯誤代碼: {error.code} | 視頻 ID: {error.videoId}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleOpenYouTube}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-800 bg-red-200 hover:bg-red-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                前往 YouTube
              </button>
              
              <button
                onClick={handleClose}
                className="inline-flex items-center px-3 py-1.5 border border-red-600 text-xs font-medium rounded text-red-300 bg-transparent hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="ml-4 flex-shrink-0 text-red-400 hover:text-red-300"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

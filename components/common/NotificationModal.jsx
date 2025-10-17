"use client";

/**
 * 通用通知彈窗組件
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否打開
 * @param {Function} props.onClose - 關閉回調
 * @param {string} props.type - 類型 ('success' | 'error' | 'info')
 * @param {string} props.title - 標題
 * @param {string} props.message - 訊息
 */
export default function NotificationModal({ isOpen, onClose, type = 'info', title, message }) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-700 animate-fadeIn">
        {/* 圖示 */}
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>

        {/* 標題 */}
        <div className="text-xl font-bold mb-2 text-center text-white">
          {title}
        </div>

        {/* 訊息 */}
        <div className="text-sm text-zinc-300 mb-6 text-center">
          {message}
        </div>

        {/* 按鈕 */}
        <div className="flex justify-center">
          <button
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            onClick={onClose}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}


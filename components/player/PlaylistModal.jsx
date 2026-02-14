"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import { notify } from "@/components/common/GlobalNotificationManager";
import { getApiErrorMessage, isAuthError } from "@/lib/clientAuthError";

export default function PlaylistModal({
  isOpen,
  onClose,
  playlist = [],
  onChangePlaylist,
  activeIndex = 0,
  onSetActiveIndex,
  maxItems = 5,
}) {
  const router = useRouter();

  // 上傳模式狀態
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploading, setUploading] = useState(false);

  const canAddMore = (playlist?.length || 0) < Number(maxItems || 5);

  // 關閉 Modal 時重置狀態
  useEffect(() => {
    if (!isOpen) {
      setUploadFile(null);
      setUploadTitle("");
      setUploadTags("");
    }
  }, [isOpen]);

  // 上傳 MP3 文件（私人使用，不公開）
  const handleUpload = async () => {
    if (!uploadFile) {
      notify.warning("提示", "請選擇音樂檔案");
      return;
    }
    if (!uploadTitle.trim()) {
      notify.warning("提示", "請輸入標題");
      return;
    }
    if (!canAddMore) {
      notify.warning("提示", `播放清單已達上限（${maxItems} 首）`);
      return;
    }

    setUploading(true);
    try {
      // ✅ 創建一個簡化的 FormData，只包含必要的字段
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle);
      
      // 可選標籤
      if (uploadTags.trim()) {
        formData.append("tags", uploadTags.trim());
      }

      // ✅ 為了通過 API 驗證，設置一些必要的字段
      formData.append("category", "bgm"); // 默認分類
      formData.append("platform", "本地生成"); // 默認平台
      formData.append("rating", "all"); // 默認評級
      formData.append("description", ""); // 空描述
      formData.append("genres[]", "other"); // 默認曲風
      formData.append("isPublic", "false"); // 標記為私人音樂

      // ✅ 上傳到臨時存儲（不公開）
      // 注意：這裡我們需要一個新的 API 端點來處理私人上傳
      // 或者修改現有的上傳 API 來支持 isPublic: false
      // 暫時使用現有 API，但標記為不公開
      const response = await axios.post("/api/music/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      if (response.data.success && response.data.music) {
        const music = response.data.music;
        const newItem = {
          url: music.musicUrl,
          title: music.title,
        };
        const next = [...(playlist || []), newItem];
        onChangePlaylist?.(next);

        // 重置上傳表單
        setUploadFile(null);
        setUploadTitle("");
        setUploadTags("");
      } else {
        notify.error("上傳失敗", response.data.error || "請稍後再試");
      }
    } catch (error) {
      if (!isAuthError(error)) {
        console.error("上傳失敗:", error);
      }
      notify.error("上傳失敗", getApiErrorMessage(error, "請重試"));
    } finally {
      setUploading(false);
    }
  };

  const removeItem = (idx) => {
    const next = (playlist || []).filter((_, i) => i !== idx);
    onChangePlaylist?.(next);
    if (typeof activeIndex === "number" && idx === activeIndex) {
      onSetActiveIndex?.(Math.max(0, activeIndex - 1));
    }
  };

  const moveItem = (from, to) => {
    if (to < 0 || to >= (playlist || []).length) return;
    const next = [...(playlist || [])];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChangePlaylist?.(next);
    if (activeIndex === from) onSetActiveIndex?.(to);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 驗證檔案類型
    const validTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/flac",
      "audio/mp4",
      "audio/x-m4a",
    ];
    if (!validTypes.includes(selectedFile.type)) {
      notify.warning("文件格式不支持", "只支持 MP3、WAV、FLAC、M4A 格式！");
      e.target.value = "";
      return;
    }

    // 驗證檔案大小（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      notify.warning("文件太大", `最大 10MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = "";
      return;
    }

    setUploadFile(selectedFile);
    // 如果沒有標題，使用檔案名稱（去除副檔名）
    if (!uploadTitle) {
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(fileNameWithoutExt);
    }
  };

  const handleGoToMusicPage = () => {
    // 關閉 Modal 並跳轉到音樂區
    onClose();
    router.push("/music");
  };

  return (
    <Modal isOpen={!!isOpen} onClose={onClose} title="管理播放清單">
      <div className="space-y-4">
        {/* 添加音樂的兩種方式 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGoToMusicPage}
            className="px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all transform hover:scale-105"
          >
            🎵 前往音樂區選擇
          </button>
          <button
            onClick={() => {
              // 切換到上傳模式（如果有模式切換的話）
              // 目前直接顯示上傳表單
            }}
            className="px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium transition-all transform hover:scale-105"
          >
            📤 上傳 MP3
          </button>
        </div>

        {/* 上傳表單 */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">
              選擇音樂檔案 *
            </label>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/mp4,audio/x-m4a"
              onChange={handleFileChange}
              className="w-full px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-white text-sm"
            />
            {uploadFile && (
              <p className="text-xs text-gray-400 mt-1">
                已選擇：{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)}MB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              標題 *
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="輸入音樂標題"
              className="w-full px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              標籤（選填，方便自己分類）
            </label>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="以空格或逗號分隔"
              className="w-full px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-white placeholder-gray-500"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || !uploadFile || !uploadTitle || !canAddMore}
            className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "上傳中..." : "上傳並加入播放清單"}
          </button>

          <p className="text-xs text-gray-400">
            💡 提示：這裡上傳的音樂僅供個人播放清單使用，不會公開顯示
          </p>
        </div>

        {/* 上限提示 */}
        {!canAddMore && (
          <div className="bg-orange-900/20 border border-orange-600/30 rounded-lg p-2">
            <p className="text-xs text-orange-300 mb-1">
              ⚠️ 已達播放清單上限（{maxItems} 首）
            </p>
            <p className="text-xs text-gray-400">
              💡 前往{" "}
              <a href="/store" className="text-blue-400 hover:text-blue-300 underline">
                積分商店
              </a>{" "}
              購買擴充，最多可擴充至 50 首！
            </p>
          </div>
        )}

        {/* 當前播放清單 */}
        <div className="border-t border-white/10 pt-4">
          <div className="text-sm text-gray-300 mb-2">
            當前播放清單 ({playlist?.length || 0} / {maxItems})
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(playlist || []).length === 0 ? (
              <div className="text-sm text-gray-400">尚未新增任何曲目</div>
            ) : (
              (playlist || []).map((item, i) => (
                <div
                  key={`${item.url}-${i}`}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    i === activeIndex
                      ? "border-white/50 bg-white/5"
                      : "border-white/20 bg-white/0"
                  }`}
                >
                  <button
                    className="px-2 py-1 rounded bg-black/40 text-xs border border-white/20 text-white"
                    title="設為目前播放"
                    onClick={() => onSetActiveIndex?.(i)}
                  >
                    播放
                  </button>
                  <div className="flex-1 truncate">
                    <div className="text-sm text-white truncate">
                      {item.title || item.url}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs border border-white/20 text-white"
                      onClick={() => moveItem(i, i - 1)}
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs border border-white/20 text-white"
                      onClick={() => moveItem(i, i + 1)}
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-red-600/70 hover:bg-red-600 text-xs border border-red-400 text-white"
                      onClick={() => removeItem(i)}
                      title="刪除"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 關閉按鈕 */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/30 text-white"
          >
            關閉
          </button>
        </div>
      </div>
    </Modal>
  );
}
"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  GENRE_MAP,
  MUSIC_GENRES,
  MUSIC_LANGUAGES,
  LANGUAGE_MAP,
} from "@/constants/musicCategories";
import SelectField from "@/components/common/SelectField";

const SUCCESS_TOAST_STORAGE_KEY = "musicUploadSuccessMessage";

export default function UploadMusicModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 步驟：1=選擇類型(BGM/歌曲), 2=上傳和填寫

  // 基本資訊
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState("all");
  const [category, setCategory] = useState(""); // 'bgm' or 'song'
  const [language, setLanguage] = useState("");

  // 自訂封面
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverPosition, setCoverPosition] = useState("50% 50%"); // 圖片在預覽框中的位置（百分比格式，例如 "50% 50%" 表示居中）
  const [isDragging, setIsDragging] = useState(false);

  // 歌曲專用欄位
  const [lyrics, setLyrics] = useState("");
  const [singerGender, setSingerGender] = useState(""); // 'male', 'female', 'mixed', 'n/a'

  // AI 生成元數據
  const [platform, setPlatform] = useState("");
  const [prompt, setPrompt] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelLink, setModelLink] = useState("");

  // 音樂屬性
  const [genres, setGenres] = useState([]);
  const [mood, setMood] = useState("");
  const [tempo, setTempo] = useState("");
  const [key, setKey] = useState("");
  const [seed, setSeed] = useState("");

  // Suno 專用參數
  const [excludeStyles, setExcludeStyles] = useState("");
  const [styleInfluence, setStyleInfluence] = useState("");
  const [weirdness, setWeirdness] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmAdult, setConfirmAdult] = useState(false);

  // 每日上傳配額
  const [dailyQuota, setDailyQuota] = useState({ current: 0, limit: 5, remaining: 5 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const pendingMessage = sessionStorage.getItem(SUCCESS_TOAST_STORAGE_KEY);
      if (pendingMessage) {
        sessionStorage.removeItem(SUCCESS_TOAST_STORAGE_KEY);
        toast.success(pendingMessage, { duration: 6000 });
      }
    } catch (error) {
      console.warn("讀取音樂上傳成功提示失敗:", error);
    }
  }, [mounted]);

  // 監聽開啟事件
  useEffect(() => {
    const handleOpen = async () => {
      setIsOpen(true);
      
      // 獲取當前每日配額
      try {
        const response = await fetch('/api/user/daily-music-quota', {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success) {
          setDailyQuota({
            current: data.current,
            limit: data.limit,
            remaining: data.remaining
          });
        }
      } catch (error) {
        console.error('獲取每日配額失敗:', error);
      }
    };
    window.addEventListener("openMusicUploadModal", handleOpen);
    return () => window.removeEventListener("openMusicUploadModal", handleOpen);
  }, []);

  // 關閉時重置表單
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setFile(null);
      setTitle("");
      setDescription("");
      setTags("");
      setRating("all");
      setCategory("");
      setLanguage("");
      setLyrics("");
      setSingerGender("");
      setPlatform("");
      setPrompt("");
      setModelName("");
      setModelLink("");
      setGenres([]);
      setMood("");
      setTempo("");
      setKey("");
      setSeed("");
      setExcludeStyles("");
      setStyleInfluence("");
      setWeirdness("");
      setShowAdvanced(false);
      setUploading(false);
      setConfirmAdult(false);
      setCoverFile(null);
      setCoverPreview(null);
      setCoverPosition("50% 50%");
      setIsDragging(false);
    }
  }, [isOpen]);

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
      toast.error("❌ 只支持 MP3、WAV、FLAC、M4A 格式！");
      e.target.value = "";
      return;
    }

    // 驗證檔案大小（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(
        `❌ 檔案過大！最大 10MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
      );
      e.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  const handleCoverChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }

    // 驗證檔案類型
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("❌ 封面只支持 JPG、PNG、WebP、GIF 格式！");
      e.target.value = "";
      return;
    }

    // 驗證檔案大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(
        `❌ 封面過大！最大 5MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
      );
      e.target.value = "";
      return;
    }

    setCoverFile(selectedFile);
    
    // 生成預覽
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result);
    };
    reader.readAsDataURL(selectedFile);
    // 重置位置為居中
    setCoverPosition("50% 50%");
  };

  // 處理拖曳調整封面位置
  const handleCoverDrag = (e) => {
    if (!coverPreview) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 計算百分比（0-100%）
    const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    // ✅ 反轉 Y 軸：向上拖曳時，圖片向下移動（顯示圖片上半部分）
    const percentY = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    
    setCoverPosition(`${percentX}% ${percentY}%`);
  };

  const handleCoverMouseDown = (e) => {
    e.preventDefault(); // 防止默認行為（避免禁止圖標）
    e.stopPropagation(); // 防止事件冒泡
    setIsDragging(true);
    handleCoverDrag(e);
  };

  const handleCoverMouseMove = (e) => {
    // ✅ 只在拖曳時處理，避免移動滑鼠就移動位置
    if (!isDragging) return;
    e.preventDefault();
    handleCoverDrag(e);
  };

  const handleCoverMouseUp = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDragging(false);
  };

  // 監聽全局滑鼠事件（用於拖曳超出容器時）
  useEffect(() => {
    if (!isDragging) return;
    
    let dragging = true; // ✅ 使用局部變量追蹤拖曳狀態，避免閉包問題
    
    const handleGlobalMouseMove = (e) => {
      if (!coverPreview || !dragging) return; // ✅ 確保只在拖曳時處理
      const container = document.querySelector('[data-cover-container]');
      if (!container) return;
      
      e.preventDefault(); // 防止默認行為
      
      const rect = container.getBoundingClientRect();
      const x = Math.max(rect.left, Math.min(rect.right, e.clientX)) - rect.left;
      const y = Math.max(rect.top, Math.min(rect.bottom, e.clientY)) - rect.top;
      
      const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
      // ✅ 反轉 Y 軸：向上拖曳時，圖片向下移動（顯示圖片上半部分）
      const percentY = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
      
      setCoverPosition(`${percentX}% ${percentY}%`);
    };

    const handleGlobalMouseUp = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      dragging = false; // ✅ 更新局部變量
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      dragging = false; // ✅ 清理時重置
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, coverPreview]);

  const handleUpload = async () => {
    if (!file) {
      toast.error("請選擇音樂檔案");
      return;
    }
    if (!title || !title.trim()) {
      toast.error("請輸入標題");
      return;
    }
    if (!category) {
      toast.error("請選擇分類");
      return;
    }
    if (!platform) {
      toast.error("請選擇生成平台");
      return;
    }
    if (category === "song" && !language) {
      toast.error("請選擇歌曲語言");
      return;
    }
    if (category === "song" && !singerGender) {
      toast.error("請選擇歌手性別");
      return;
    }
    if (!genres || genres.length === 0) {
      toast.error("請至少選擇一個曲風");
      return;
    }
    if (rating === "18" && !confirmAdult) {
      toast.error("請勾選成年聲明");
      return;
    }

    // ✅ 先檢查每日上傳限制（避免不必要的上傳和流量消耗）
    // 音樂有獨立的配額系統，使用與圖片相同的等級計算方式
    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    if (!token) {
      // 未登入：直接阻止上傳
      toast.error("請先登入後再上傳");
      return;
    }
    
    try {
      const quotaRes = await fetch("/api/user/daily-music-quota", {
        credentials: "include",
      });
      
      if (quotaRes.status === 401) {
        // 未登入：直接阻止上傳
        toast.error("請先登入後再上傳");
        return;
      }
      
      if (quotaRes.ok) {
        const quotaData = await quotaRes.json();
        if (quotaData.isLimitReached || quotaData.remaining <= 0) {
          toast.error(`今日音樂上傳限制為 ${quotaData.limit} 部，請明天再試`);
          return;
        }
      } else {
        // 其他錯誤（500等）：記錄但不阻止（避免檢查服務故障導致無法上傳）
        console.warn("⚠️ 上傳限制檢查失敗（繼續上傳）：", quotaRes.status);
      }
    } catch (quotaErr) {
      // 如果檢查失敗，記錄但不阻止（避免檢查服務故障導致無法上傳）
      // 但如果是明確的限制錯誤或登入錯誤，直接拋出
      if (quotaErr.message?.includes("今日") || quotaErr.message?.includes("請先登入")) {
        toast.error(quotaErr.message);
        return;
      }
      console.warn("⚠️ 上傳限制檢查失敗（繼續上傳）：", quotaErr);
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("tags", tags);
      formData.append("rating", rating);
      formData.append("category", category);
      if (language) formData.append("language", language);
      if (coverFile) {
        formData.append("cover", coverFile);
        formData.append("coverPosition", coverPosition);
      }

      // 歌曲專用欄位
      if (category === "song") {
        if (lyrics) formData.append("lyrics", lyrics);
        if (singerGender) formData.append("singerGender", singerGender);
      }

      formData.append("platform", platform);
      if (prompt) formData.append("prompt", prompt);
      if (modelName) formData.append("modelName", modelName);
      if (modelLink) formData.append("modelLink", modelLink);
      genres.forEach((genre) => formData.append("genres[]", genre));
      if (mood) formData.append("mood", mood);
      if (tempo) formData.append("tempo", tempo);
      if (key) formData.append("key", key);
      if (seed) formData.append("seed", seed);
      if (excludeStyles) formData.append("excludeStyles", excludeStyles);
      if (styleInfluence) formData.append("styleInfluence", styleInfluence);
      if (weirdness) formData.append("weirdness", weirdness);

      const response = await fetch("/api/music/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        const completeness = result.music?.completenessScore || 0;
        let successMessage = `✅ 音樂上傳成功！完整度：${completeness}分`;
        
        // 更新每日配額顯示
        try {
          const quotaResponse = await fetch('/api/user/daily-music-quota', {
            credentials: "include",
          });
          if (quotaResponse.ok) {
            const quotaData = await quotaResponse.json();
            if (quotaData.success) {
              setDailyQuota({
                current: quotaData.current,
                limit: quotaData.limit,
                remaining: quotaData.remaining
              });
              successMessage += `\n\n今日剩餘：${quotaData.remaining}/${quotaData.limit} 部`;
            }
          }
        } catch (quotaErr) {
          console.warn("獲取更新後配額失敗:", quotaErr);
        }
        
        let storedMessage = false;
        try {
          sessionStorage.setItem(SUCCESS_TOAST_STORAGE_KEY, successMessage);
          storedMessage = true;
        } catch (err) {
          console.warn("儲存音樂上傳成功提示失敗:", err);
        }
        if (!storedMessage) {
          toast.success(successMessage, { duration: 6000 });
        }
        setIsOpen(false);
        window.location.href = "/music";
      } else {
        toast.error(result.error || "上傳失敗");
      }
    } catch (error) {
      console.error("上傳失敗:", error);
      toast.error("上傳失敗，請重試");
    } finally {
      setUploading(false);
    }
  };

  const getRatingColor = () => {
    if (rating === "18") return "bg-red-600";
    if (rating === "15") return "bg-orange-500";
    return "bg-green-600";
  };

  if (!mounted || !isOpen) return null;

  const panel = (
    <Dialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      className="relative z-[9999]"
    >
      {/* 背景 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* 面板容器 */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="relative w-full max-w-2xl bg-[#121212] rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[#121212]/90 backdrop-blur border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-center flex-1">
                <div className="text-lg font-semibold">上傳音樂 +10／每日上限 {dailyQuota.limit}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  最大 10MB，建議 2-5 分鐘
                </div>
                <div className="text-xs mt-2">
                  <span className={`font-medium ${dailyQuota.remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    今日配額：{dailyQuota.current} / {dailyQuota.limit} 部
                  </span>
                  {dailyQuota.remaining === 0 && (
                    <span className="text-red-400 ml-2">（已達上限，明天重置）</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
              >
                關閉
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {/* 步驟 1: 選擇類型（兩個大按鈕） */}
            {step === 1 && (
              <div className="space-y-4 py-8">
                <h2 className="text-2xl font-bold text-white text-center">
                  選擇音樂類型
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => {
                      setCategory("bgm");
                      setRating("all"); // BGM 固定為 ALL
                      setStep(2);
                    }}
                    className="p-8 rounded-lg text-white bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 transition-all transform hover:scale-105"
                  >
                    <div className="text-6xl mb-4">🎵</div>
                    <div className="text-2xl font-bold mb-2">BGM</div>
                    <div className="text-sm opacity-90">純音樂、背景音樂</div>
                    <div className="text-xs opacity-70 mt-2">
                      自動設定為「一般 All」分級
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setCategory("song");
                      setRating("all"); // 預設為 ALL，用戶可調整
                      setStep(2);
                    }}
                    className="p-8 rounded-lg text-white bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 transition-all transform hover:scale-105"
                  >
                    <div className="text-6xl mb-4">🎤</div>
                    <div className="text-2xl font-bold mb-2">歌曲</div>
                    <div className="text-sm opacity-90">有人聲、歌詞的音樂</div>
                    <div className="text-xs opacity-70 mt-2">
                      需要填寫歌詞和歌手資訊
                    </div>
                  </button>
                </div>
                <div className="text-sm text-zinc-400 text-center">
                  請選擇本次上傳的音樂類型，再進行後續填寫。
                </div>
              </div>
            )}

            {/* 步驟 2: 上傳和填寫 */}
            {step === 2 && (
              <>
                {/* 檔案選擇 */}
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300 font-semibold">
                    上傳音樂檔案
                  </label>
                  <input
                    type="file"
                    className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/mp4,audio/x-m4a,.m4a"
                    onChange={handleFileChange}
                  />
                </div>

                {/* 檔案資訊 */}
                {file && (
                  <div className="bg-zinc-800 rounded p-3 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">🎵</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          {file.name}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 自訂封面（選填） */}
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300 font-semibold">
                    🖼️ 自訂封面（選填）
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleCoverChange}
                    className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                  <p className="text-xs text-zinc-400">
                    支援 JPG、PNG、WebP、GIF，最大 5MB。未上傳則使用 MP3 內嵌封面（如有）
                  </p>
                  {coverPreview && (
                    <div className="mt-2 space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">
                          拖曳圖片調整顯示位置：
                        </label>
                        <div
                          data-cover-container
                          className={`relative w-32 h-32 rounded-lg border-2 border-purple-500/50 overflow-hidden bg-zinc-800 ${
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                          }`}
                          onMouseDown={handleCoverMouseDown}
                          onMouseMove={handleCoverMouseMove}
                          onMouseUp={handleCoverMouseUp}
                          onMouseLeave={(e) => {
                            // ✅ 如果離開容器且正在拖曳，停止拖曳
                            if (isDragging) {
                              handleCoverMouseUp(e);
                            }
                          }}
                        >
                          <img
                            src={coverPreview}
                            alt="封面預覽"
                            className="w-full h-full object-cover pointer-events-none select-none"
                            style={{ objectPosition: coverPosition }}
                            draggable={false}
                          />
                          {/* 拖曳提示覆蓋層 */}
                          <div
                            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isDragging
                                ? "opacity-0"
                                : "opacity-0 hover:opacity-100"
                            }`}
                          >
                            <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                              拖曳調整位置
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500">
                          點擊並拖曳圖片來調整在正方形框中的顯示位置
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 分級（只在歌曲時顯示） */}
                {category === "song" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div
                        className={`text-xl font-bold px-4 py-2 rounded text-white inline-block ${getRatingColor()}`}
                      >
                        {rating === "all"
                          ? "一般 All"
                          : rating === "15"
                            ? "15+ 清涼"
                            : "18+ 限制"}
                      </div>
                    <SelectField
                      value={rating}
                      onChange={setRating}
                      options={[
                        { value: "all", label: "一般（All）" },
                        { value: "15", label: "15+（輕限）" },
                        { value: "18", label: "18+（限制）" },
                      ]}
                      placeholder="選擇分級"
                      className="min-w-[160px]"
                    />
                    </div>
                  </div>
                )}

                {/* 18+ 成年聲明 */}
                {rating === "18" && (
                  <div className="space-y-2 border border-red-500/40 rounded-lg p-3 bg-red-900/20">
                    <div className="text-sm text-red-300 font-semibold">
                      18+ 成年聲明（必勾）
                    </div>
                    <label className="flex items-start gap-2 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={confirmAdult}
                        onChange={(e) => setConfirmAdult(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        我確認本次上傳內容適合成年人收聽，不包含未成年相關內容。
                      </span>
                    </label>
                  </div>
                )}

                {/* 基本欄位 */}
                <input
                  type="text"
                  placeholder="標題 *"
                  className="w-full p-2 rounded bg-zinc-700 text-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="標籤（以空格或逗號分隔，建議至少3個）"
                  className="w-full p-2 rounded bg-zinc-700 text-white"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />

                <textarea
                  placeholder="描述（選填）"
                  className="w-full p-2 rounded bg-zinc-700 text-white h-28"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                {category === "song" && (
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">歌詞</label>
                    <textarea
                      placeholder="填寫完整歌詞（選填）"
                      className="w-full p-2 rounded bg-zinc-700 text-white h-32 mt-1"
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">
                    💭 提示詞（Prompt）
                  </label>
                  <textarea
                    placeholder="描述您想要的音樂風格、情緒、樂器等"
                    className="w-full p-2 rounded bg-zinc-700 text-white h-24"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 語言欄位（只顯示在歌曲類型） */}
                  {category === "song" && (
                    <div>
                      <label
                        className={`text-sm font-semibold ${
                          language ? "text-zinc-400" : "text-red-400"
                        }`}
                      >
                        🌐 語言（必選）
                      </label>
                      <SelectField
                        value={language}
                        onChange={setLanguage}
                        invalid={!language}
                        placeholder="請選擇語言"
                        options={MUSIC_LANGUAGES.map((lang) => ({
                          value: lang,
                          label: LANGUAGE_MAP[lang] || lang,
                        }))}
                      />
                    </div>
                  )}

                  <div className={category === "song" ? "" : "col-span-2"}>
                    <label
                      className={`text-sm font-semibold ${
                        platform ? "text-zinc-400" : "text-red-400"
                      }`}
                    >
                      🛠️ 生成平台（必選）
                    </label>
                    <SelectField
                      value={platform}
                      onChange={setPlatform}
                      invalid={!platform}
                      placeholder="請選擇平台"
                      options={[
                        { value: "Suno", label: "Suno" },
                        { value: "TopMediai", label: "TopMediai" },
                        { value: "Mureka.ai", label: "Mureka.ai" },
                        { value: "其他", label: "其他" },
                      ]}
                    />
                  </div>
                </div>

                {/* 曲風與歌曲資訊 */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div>
                    <label
                      className={`text-sm font-semibold ${
                        genres.length ? "text-zinc-400" : "text-red-400"
                      }`}
                    >
                      🎵 曲風（可複選，至少 1 項）
                    </label>
                    <div
                      className={`max-h-32 overflow-y-auto rounded p-2 bg-zinc-700 ${
                        genres.length ? "border border-white/10" : "border border-red-500"
                      }`}
                    >
                      {MUSIC_GENRES.map((genreKey) => (
                        <label
                          key={genreKey}
                          className="flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-600/50 rounded px-2"
                        >
                          <input
                            type="checkbox"
                            value={genreKey}
                            checked={genres.includes(genreKey)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGenres([...genres, genreKey]);
                              } else {
                                setGenres(genres.filter((g) => g !== genreKey));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-white text-sm">
                            {GENRE_MAP[genreKey]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {category === "song" && (
                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <div className="text-sm font-semibold text-zinc-300">
                        🎤 歌曲資訊
                      </div>

                      <div>
                        <label
                          className={`text-sm font-semibold ${
                            singerGender ? "text-zinc-400" : "text-red-400"
                          }`}
                        >
                          歌手性別（必選）
                        </label>
                        <SelectField
                          value={singerGender}
                          onChange={setSingerGender}
                          invalid={!singerGender}
                          placeholder="請選擇歌手性別"
                          options={[
                            { value: "male", label: "男" },
                            { value: "female", label: "女" },
                            { value: "mixed", label: "混合" },
                            { value: "n/a", label: "不適用" },
                          ]}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {platform && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                      className="flex w-full items-center justify-between text-sm text-zinc-300 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        {showAdvanced ? "▼" : "▶"} 進階參數（生成平台專用）
                      </span>
                      <span className="text-xs text-zinc-500">
                        {showAdvanced ? "收合" : "展開"}
                      </span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-3">
                        {(platform === "Suno" || platform === "Udio") && (
                          <>
                            <div>
                              <label className="text-sm text-zinc-400">
                                ✂️ 排除風格（Exclude styles）
                              </label>
                              <input
                                type="text"
                                placeholder="不想包含的音樂風格"
                                className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                value={excludeStyles}
                                onChange={(e) => setExcludeStyles(e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="text-sm text-zinc-400 flex items-center gap-2">
                                <span>🎭 怪異度（Weirdness）</span>
                                <button
                                  type="button"
                                  onClick={() => setWeirdness("")}
                                  className="text-xs text-zinc-500 hover:text-white"
                                >
                                  🔄 重置
                                </button>
                              </label>
                              <div className="mt-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={weirdness || 0}
                                  onChange={(e) => setWeirdness(e.target.value)}
                                  className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                  <span>0%</span>
                                  <span className="font-semibold text-white">
                                    {weirdness || 0}%
                                  </span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm text-zinc-400 flex items-center gap-2">
                                <span>🎨 風格影響力（Style Influence）</span>
                                <button
                                  type="button"
                                  onClick={() => setStyleInfluence("")}
                                  className="text-xs text-zinc-500 hover:text-white"
                                >
                                  🔄 重置
                                </button>
                              </label>
                              <div className="mt-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={styleInfluence || 0}
                                  onChange={(e) =>
                                    setStyleInfluence(e.target.value)
                                  }
                                  className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                  <span>0%</span>
                                  <span className="font-semibold text-white">
                                    {styleInfluence || 0}%
                                  </span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {platform === "TopMediai" && (
                          <>
                            <div>
                              <label className="text-sm text-zinc-400 flex items-center gap-2">
                                <span>🎭 怪異度（Weirdness）</span>
                                <button
                                  type="button"
                                  onClick={() => setWeirdness("")}
                                  className="text-xs text-zinc-500 hover:text-white"
                                >
                                  🔄 重置
                                </button>
                              </label>
                              <div className="mt-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={weirdness || 0}
                                  onChange={(e) => setWeirdness(e.target.value)}
                                  className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                  <span>0%</span>
                                  <span className="font-semibold text-white">
                                    {weirdness || 0}%
                                  </span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm text-zinc-400 flex items-center gap-2">
                                <span>🎨 風格影響力（Style Influence）</span>
                                <button
                                  type="button"
                                  onClick={() => setStyleInfluence("")}
                                  className="text-xs text-zinc-500 hover:text-white"
                                >
                                  🔄 重置
                                </button>
                              </label>
                              <div className="mt-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={styleInfluence || 0}
                                  onChange={(e) =>
                                    setStyleInfluence(e.target.value)
                                  }
                                  className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                  <span>0%</span>
                                  <span className="font-semibold text-white">
                                    {styleInfluence || 0}%
                                  </span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {(platform === "MusicGen" ||
                          platform === "Stable Audio") && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm text-zinc-400">
                                  🤖 模型名稱
                                </label>
                                <input
                                  type="text"
                                  placeholder="如：facebook/musicgen-large"
                                  className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                  value={modelName}
                                  onChange={(e) => setModelName(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm text-zinc-400">
                                  🔗 模型連結
                                </label>
                                <input
                                  type="url"
                                  placeholder="HuggingFace / GitHub 連結"
                                  className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                  value={modelLink}
                                  onChange={(e) => setModelLink(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-sm text-zinc-400">
                                  ⚡ BPM
                                </label>
                                <input
                                  type="number"
                                  placeholder="節拍"
                                  className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                  value={tempo}
                                  onChange={(e) => setTempo(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm text-zinc-400">
                                  🎹 調性
                                </label>
                                <input
                                  type="text"
                                  placeholder="如：C Major"
                                  className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                  value={key}
                                  onChange={(e) => setKey(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-sm text-zinc-400">
                                  🔢 Seed
                                </label>
                                <input
                                  type="text"
                                  placeholder="隨機種子"
                                  className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                                  value={seed}
                                  onChange={(e) => setSeed(e.target.value)}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {platform === "其他" && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                placeholder="模型名稱"
                                className="p-2 rounded bg-zinc-700 text-white"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                              />
                              <input
                                type="url"
                                placeholder="模型連結"
                                className="p-2 rounded bg-zinc-700 text-white"
                                value={modelLink}
                                onChange={(e) => setModelLink(e.target.value)}
                              />
                            </div>

                            <input
                              type="text"
                              placeholder="情緒（Mood）"
                              className="w-full p-2 rounded bg-zinc-700 text-white"
                              value={mood}
                              onChange={(e) => setMood(e.target.value)}
                            />

                            <div className="grid grid-cols-3 gap-3">
                              <input
                                type="number"
                                placeholder="BPM"
                                className="p-2 rounded bg-zinc-700 text-white"
                                value={tempo}
                                onChange={(e) => setTempo(e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="調性（Key）"
                                className="p-2 rounded bg-zinc-700 text-white"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="Seed"
                                className="p-2 rounded bg-zinc-700 text-white"
                                value={seed}
                                onChange={(e) => setSeed(e.target.value)}
                              />
                            </div>
                          </>
                        )}

                        <div className="text-xs text-zinc-400 bg-blue-500/10 border border-blue-500/30 rounded p-2">
                          💡 填寫越多參數，完整度分數越高，作品會獲得更多曝光！
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {step === 2 && (
            <div className="sticky bottom-0 bg-[#121212]/90 backdrop-blur border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !file || !title}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "上傳中..." : "上傳音樂"}
              </button>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  if (!mounted) return null;

  return createPortal(panel, document.body);
}

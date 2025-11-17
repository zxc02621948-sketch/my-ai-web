"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/common/Modal";
import toast from "react-hot-toast";
import {
  GENRE_MAP,
  MUSIC_GENRES,
  MUSIC_LANGUAGES,
  LANGUAGE_MAP,
} from "@/constants/musicCategories";

export default function EditMusicModal({
  music,
  isOpen,
  onClose,
  onMusicUpdated,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 表單狀態
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    category: "",
    rating: "all",
    platform: "",
    prompt: "",
    modelName: "",
    modelLink: "",
    genre: [],
    language: "",
    mood: "",
    tempo: "",
    key: "",
    lyrics: "",
    singerGender: "",
    seed: "",
    excludeStyles: "",
    styleInfluence: "",
    weirdness: "",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmAdult, setConfirmAdult] = useState(false);

  // 封面圖相關狀態
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverPosition, setCoverPosition] = useState("50% 50%");
  const [isDragging, setIsDragging] = useState(false);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(null);

  // 載入音樂數據
  useEffect(() => {
    if (!music || !isOpen) return;

    setForm({
      title: music.title || "",
      description: music.description || "",
      tags: Array.isArray(music.tags) ? music.tags.join(" ") : music.tags || "",
      category: music.category || "",
      rating: music.rating || "all",
      platform: music.platform || "",
      prompt: music.prompt || "",
      modelName: music.modelName || "",
      modelLink: music.modelLink || "",
      genre: Array.isArray(music.genre) ? music.genre : [],
      language: music.language || "",
      mood: music.mood || "",
      tempo: music.tempo ? String(music.tempo) : "",
      key: music.key || "",
      lyrics: music.lyrics || "",
      singerGender: music.singerGender || "",
      seed: music.seed || "",
      excludeStyles: music.excludeStyles || "",
      styleInfluence: music.styleInfluence ? String(music.styleInfluence) : "",
      weirdness: music.weirdness ? String(music.weirdness) : "",
    });

    setConfirmAdult(music.rating === "18");
    
    // 初始化封面圖狀態
    setCurrentCoverUrl(music.coverImageUrl || null);
    setCoverPreview(music.coverImageUrl || null);
    setCoverPosition(music.coverPosition || "50% 50%");
    setCoverFile(null);
    setIsDragging(false);
  }, [music, isOpen]);

  const handleSave = async () => {
    if (!form.title || !form.title.trim()) {
      toast.error("請輸入標題");
      return;
    }

    if (form.rating === "18" && !confirmAdult) {
      toast.error("請確認已滿18歲");
      return;
    }

    // ✅ 如果有新封面或現有封面，且音樂分級不是 18+，再次提醒並確認
    const hasCover = coverFile !== null || (currentCoverUrl && !coverFile);
    if (hasCover && (form.rating === "all" || form.rating === "15")) {
      // 檢查分級是否有變更（從 18+ 改為較低分級）
      const ratingChanged = music.rating === "18" && form.rating !== "18";
      const message = ratingChanged
        ? `⚠️ 您將音樂分級從「18+」改為「${form.rating === "all" ? "全年齡" : "15+"}」，請確認封面內容符合新的分級規範。\n\n是否繼續保存？`
        : `⚠️ 此音樂分級為「${form.rating === "all" ? "全年齡" : "15+"}」，請確認封面內容符合分級規範。\n\n是否繼續保存？`;
      
      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);

    try {
      // 如果有新封面文件，使用 FormData；否則使用 JSON
      const hasNewCover = coverFile !== null;
      
      let response;
      if (hasNewCover) {
        // 使用 FormData 上傳（包含封面文件）
        const formData = new FormData();
        formData.append("title", form.title.trim());
        formData.append("description", form.description.trim());
        formData.append("tags", form.tags);
        formData.append("category", form.category);
        formData.append("rating", form.rating);
        formData.append("platform", form.platform.trim());
        formData.append("prompt", form.prompt.trim());
        formData.append("modelName", form.modelName.trim());
        formData.append("modelLink", form.modelLink.trim());
        form.genre.forEach((g) => formData.append("genre", g));
        formData.append("language", form.language);
        formData.append("mood", form.mood.trim());
        if (form.tempo) formData.append("tempo", String(form.tempo));
        formData.append("key", form.key.trim());
        formData.append("lyrics", form.lyrics.trim());
        formData.append("singerGender", form.singerGender);
        formData.append("seed", form.seed.trim());
        formData.append("excludeStyles", form.excludeStyles.trim());
        if (form.styleInfluence) formData.append("styleInfluence", String(form.styleInfluence));
        if (form.weirdness) formData.append("weirdness", String(form.weirdness));
        formData.append("cover", coverFile);
        formData.append("coverPosition", coverPosition);

        response = await fetch(`/api/music/${music._id}/edit`, {
          method: "PATCH",
          credentials: "include",
          body: formData,
        });
      } else {
        // 使用 JSON（沒有新封面，但可能更新位置）
        const body = {
          title: form.title.trim(),
          description: form.description.trim(),
          tags: form.tags,
          category: form.category,
          rating: form.rating,
          platform: form.platform.trim(),
          prompt: form.prompt.trim(),
          modelName: form.modelName.trim(),
          modelLink: form.modelLink.trim(),
          genre: form.genre,
          language: form.language,
          mood: form.mood.trim(),
          tempo: form.tempo ? Number(form.tempo) : null,
          key: form.key.trim(),
          lyrics: form.lyrics.trim(),
          singerGender: form.singerGender,
          seed: form.seed.trim(),
          excludeStyles: form.excludeStyles.trim(),
          styleInfluence: form.styleInfluence ? Number(form.styleInfluence) : null,
          weirdness: form.weirdness ? Number(form.weirdness) : null,
        };
        
        // 如果位置有變化，也發送位置（但沒有新文件，API 需要特殊處理）
        // 注意：如果只更新位置而沒有新文件，我們需要通過 FormData 發送
        if (coverPosition !== (music.coverPosition || "50% 50%")) {
          const formData = new FormData();
          Object.keys(body).forEach((key) => {
            if (Array.isArray(body[key])) {
              body[key].forEach((item) => formData.append(key, item));
            } else if (body[key] !== null && body[key] !== undefined) {
              formData.append(key, String(body[key]));
            }
          });
          formData.append("coverPosition", coverPosition);
          
          response = await fetch(`/api/music/${music._id}/edit`, {
            method: "PATCH",
            credentials: "include",
            body: formData,
          });
        } else {
          response = await fetch(`/api/music/${music._id}/edit`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(body),
          });
        }
      }

      const result = await response.json();

      if (result.ok && result.music) {
        toast.success("音樂更新成功！");
        onMusicUpdated?.(result.music);
        onClose();
      } else {
        toast.error(result.message || "更新失敗");
      }
    } catch (error) {
      console.error("更新音樂失敗:", error);
      toast.error("更新失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const toggleGenre = (genreKey) => {
    setForm((prev) => {
      const newGenres = prev.genre.includes(genreKey)
        ? prev.genre.filter((g) => g !== genreKey)
        : [...prev.genre, genreKey];
      return { ...prev, genre: newGenres };
    });
  };

  // 處理封面圖上傳
  const handleCoverChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setCoverFile(null);
      setCoverPreview(currentCoverUrl);
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

    // ✅ 檢查音樂分級，提醒用戶封面需符合分級規範
    if (form.rating === "all" || form.rating === "15") {
      toast.warning(
        `⚠️ 此音樂分級為「${form.rating === "all" ? "全年齡" : "15+"}」，請確保封面內容符合分級規範！`,
        { duration: 5000 }
      );
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
    
    const container = e.currentTarget || document.querySelector('[data-cover-container-edit]');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 計算百分比（0-100%）
    const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const percentY = Math.max(0, Math.min(100, (y / rect.height) * 100));
    
    setCoverPosition(`${percentX}% ${percentY}%`);
  };

  const handleCoverMouseDown = (e) => {
    setIsDragging(true);
    handleCoverDrag(e);
  };

  const handleCoverMouseMove = (e) => {
    if (isDragging) {
      handleCoverDrag(e);
    }
  };

  const handleCoverMouseUp = () => {
    setIsDragging(false);
  };

  // 監聽全局滑鼠事件（用於拖曳超出容器時）
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e) => {
        if (!coverPreview) return;
        const container = document.querySelector('[data-cover-container-edit]');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const x = Math.max(rect.left, Math.min(rect.right, e.clientX)) - rect.left;
        const y = Math.max(rect.top, Math.min(rect.bottom, e.clientY)) - rect.top;
        
        const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const percentY = Math.max(0, Math.min(100, (y / rect.height) * 100));
        
        setCoverPosition(`${percentX}% ${percentY}%`);
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, coverPreview]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="編輯音樂" zIndex={100000}>
      <div className="space-y-4">
        {/* 基礎資訊 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              標題 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              placeholder="音樂標題"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              描述
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              placeholder="音樂描述"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* 自訂封面編輯 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              🖼️ 自訂封面（選填）
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleCoverChange}
              className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
            />
            <p className="text-xs text-zinc-400 mt-1">
              支援 JPG、PNG、WebP、GIF，最大 5MB。未上傳則保持原有封面
            </p>
            {coverPreview && (
              <div className="mt-3 space-y-2">
                {/* ✅ 分級提示 */}
                {(form.rating === "all" || form.rating === "15") && (
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded p-2 text-xs text-yellow-300">
                    ⚠️ 此音樂分級為「{form.rating === "all" ? "全年齡" : "15+"}」，封面內容需符合分級規範
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">
                    拖曳圖片調整顯示位置：
                  </label>
                  <div
                    data-cover-container-edit
                    className="relative w-32 h-32 rounded-lg border-2 border-purple-500/50 overflow-hidden bg-zinc-800 cursor-move"
                    onMouseDown={handleCoverMouseDown}
                    onMouseMove={handleCoverMouseMove}
                    onMouseUp={handleCoverMouseUp}
                    onMouseLeave={() => {
                      if (!isDragging) return;
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              標籤（用空格、逗號分隔）
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              placeholder="標籤1 標籤2 標籤3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                類別 <span className="text-red-400">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              >
                <option value="">選擇類別</option>
                <option value="bgm">BGM</option>
                <option value="song">歌曲</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                分級 <span className="text-red-400">*</span>
              </label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              >
                <option value="all">全年齡</option>
                <option value="15">15+</option>
                <option value="18">18+</option>
              </select>
            </div>
          </div>

          {form.rating === "18" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="confirmAdult"
                checked={confirmAdult}
                onChange={(e) => setConfirmAdult(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="confirmAdult" className="text-sm text-gray-300">
                我已確認內容為18+限制級
              </label>
            </div>
          )}
        </div>

        {/* AI 生成資訊 */}
        <div className="space-y-4 border-t border-zinc-700 pt-4">
          <h3 className="text-lg font-semibold text-white">AI 生成資訊</h3>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              生成平台 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              placeholder="例如：Suno, Udio, MusicGen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              提示詞
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              placeholder="生成提示詞"
              rows={3}
            />
          </div>

          {/* 模型名稱與連結：僅 MusicGen / Stable Audio 顯示 */}
          {(form.platform === "MusicGen" ||
            form.platform === "Stable Audio") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  模型名稱
                </label>
                <input
                  type="text"
                  value={form.modelName}
                  onChange={(e) =>
                    setForm({ ...form, modelName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="模型名稱"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  模型連結
                </label>
                <input
                  type="text"
                  value={form.modelLink}
                  onChange={(e) =>
                    setForm({ ...form, modelLink: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="模型連結"
                />
              </div>
            </div>
          )}
        </div>

        {/* 音樂屬性 */}
        <div className="space-y-4 border-t border-zinc-700 pt-4">
          <h3 className="text-lg font-semibold text-white">音樂屬性</h3>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              風格 <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MUSIC_GENRES.map((genreKey) => (
                <button
                  key={genreKey}
                  type="button"
                  onClick={() => toggleGenre(genreKey)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    form.genre.includes(genreKey)
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
                  }`}
                >
                  {GENRE_MAP[genreKey] || genreKey}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              語言
            </label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            >
              <option value="">選擇語言</option>
              {MUSIC_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_MAP[lang] || lang}
                </option>
              ))}
            </select>
          </div>

          {/* 情緒、BPM、調性：僅 MusicGen / Stable Audio 顯示 */}
          {(form.platform === "MusicGen" ||
            form.platform === "Stable Audio") && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    情緒
                  </label>
                  <input
                    type="text"
                    value={form.mood}
                    onChange={(e) =>
                      setForm({ ...form, mood: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="例如：Happy, Sad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    BPM
                  </label>
                  <input
                    type="number"
                    value={form.tempo}
                    onChange={(e) =>
                      setForm({ ...form, tempo: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="例如：120"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  調性
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="例如：C Major, A Minor"
                />
              </div>
            </>
          )}
        </div>

        {/* 歌曲專用屬性 */}
        {form.category === "song" && (
          <div className="space-y-4 border-t border-zinc-700 pt-4">
            <h3 className="text-lg font-semibold text-white">歌曲資訊</h3>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                歌詞
              </label>
              <textarea
                value={form.lyrics}
                onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                placeholder="歌詞內容"
                rows={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                歌手性別
              </label>
              <select
                value={form.singerGender}
                onChange={(e) =>
                  setForm({ ...form, singerGender: e.target.value })
                }
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              >
                <option value="">未設定</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="mixed">混合</option>
                <option value="n/a">不適用</option>
              </select>
            </div>
          </div>
        )}

        {/* 進階參數 */}
        <div className="border-t border-zinc-700 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            {showAdvanced ? "隱藏" : "顯示"}進階參數
          </button>

          {showAdvanced && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Seed
                </label>
                <input
                  type="text"
                  value={form.seed}
                  onChange={(e) => setForm({ ...form, seed: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="Seed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  排除風格
                </label>
                <input
                  type="text"
                  value={form.excludeStyles}
                  onChange={(e) =>
                    setForm({ ...form, excludeStyles: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  placeholder="排除的風格"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    風格影響力 (%)
                  </label>
                  <input
                    type="number"
                    value={form.styleInfluence}
                    onChange={(e) =>
                      setForm({ ...form, styleInfluence: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="0-100"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    怪異度 (%)
                  </label>
                  <input
                    type="number"
                    value={form.weirdness}
                    onChange={(e) =>
                      setForm({ ...form, weirdness: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="0-100"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </Modal>
  );
}


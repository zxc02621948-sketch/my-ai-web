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

  useEffect(() => setMounted(true), []);

  // 監聽開啟事件
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
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
    if (!genres || genres.length === 0) {
      toast.error("請至少選擇一個曲風");
      return;
    }
    if (rating === "18" && !confirmAdult) {
      toast.error("請勾選成年聲明");
      return;
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
        toast.success(`✅ 音樂上傳成功！完整度：${completeness}分`);
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
                <div className="text-lg font-semibold">🎵 上傳音樂</div>
                <div className="text-xs text-zinc-400 mt-1">
                  最大 10MB，建議 2-5 分鐘
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
                      <select
                        className="p-2 rounded bg-zinc-700 text-white"
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                      >
                        <option value="all">一般（All）</option>
                        <option value="15">15+（輕限）</option>
                        <option value="18">18+（限制）</option>
                      </select>
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

                <div className="grid grid-cols-2 gap-3">
                  {/* 語言欄位（只顯示在歌曲類型） */}
                  {category === "song" && (
                    <div>
                      <label className="text-sm text-zinc-400">🌐 語言</label>
                      <select
                        className="p-2 rounded bg-zinc-700 text-white w-full"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        <option value="">選擇語言（選填）</option>
                        {MUSIC_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {LANGUAGE_MAP[lang] || lang}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={category === "song" ? "" : "col-span-2"}>
                    <label className="text-sm text-zinc-400">🛠️ 生成平台</label>
                    <select
                      className="p-2 rounded bg-zinc-700 text-white w-full"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                    >
                      <option value="">選擇平台（選填）</option>
                      <option value="Suno">Suno</option>
                      <option value="Udio">Udio</option>
                      <option value="MusicGen">MusicGen</option>
                      <option value="Stable Audio">Stable Audio</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400">
                    🎵 曲風（可複選）
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-white/10 rounded p-2 bg-zinc-700">
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

                {/* 歌曲專用欄位 */}
                {category === "song" && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="text-sm font-semibold text-zinc-300">
                      🎤 歌曲資訊
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400">歌詞</label>
                      <textarea
                        placeholder="填寫完整歌詞（選填）"
                        className="w-full p-2 rounded bg-zinc-700 text-white h-32 mt-1"
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400">歌手性別</label>
                      <select
                        className="p-2 rounded bg-zinc-700 text-white w-full mt-1"
                        value={singerGender}
                        onChange={(e) => setSingerGender(e.target.value)}
                      >
                        <option value="">選擇歌手性別（選填）</option>
                        <option value="male">男</option>
                        <option value="female">女</option>
                        <option value="mixed">混合</option>
                        <option value="n/a">不適用</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 動態顯示平台對應的元數據欄位 */}
                {platform && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="text-sm font-semibold text-zinc-300">
                      📋{" "}
                      {platform === "Suno"
                        ? "Suno"
                        : platform === "Udio"
                          ? "Udio"
                          : platform === "MusicGen"
                            ? "MusicGen"
                            : platform === "Stable Audio"
                              ? "Stable Audio"
                              : "生成平台"}{" "}
                      元數據
                    </div>

                    {/* Suno / Udio */}
                    {(platform === "Suno" || platform === "Udio") && (
                      <>
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

                    {/* MusicGen / Stable Audio */}
                    {(platform === "MusicGen" ||
                      platform === "Stable Audio") && (
                      <>
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

                    {/* 其他平台 */}
                    {platform === "其他" && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-400">
                            💭 生成提示詞
                          </label>
                          <textarea
                            placeholder="描述您想要的音樂風格、情緒、樂器等"
                            className="w-full p-2 rounded bg-zinc-700 text-white h-24"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                          />
                        </div>

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

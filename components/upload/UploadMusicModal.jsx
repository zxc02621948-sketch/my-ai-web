'use client';

import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import MUSIC_CATEGORIES from '@/constants/musicCategories';

export default function UploadMusicModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // 基本資訊
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('all');
  const [category, setCategory] = useState('');
  
  // AI 生成元數據
  const [platform, setPlatform] = useState('');
  const [prompt, setPrompt] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelLink, setModelLink] = useState('');
  
  // 音樂屬性
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [tempo, setTempo] = useState('');
  const [key, setKey] = useState('');
  const [seed, setSeed] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmAdult, setConfirmAdult] = useState(false);

  useEffect(() => setMounted(true), []);

  // 監聽開啟事件
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('openMusicUploadModal', handleOpen);
    return () => window.removeEventListener('openMusicUploadModal', handleOpen);
  }, []);

  // 關閉時重置表單
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setTitle('');
      setDescription('');
      setTags('');
      setRating('all');
      setCategory('');
      setPlatform('');
      setPrompt('');
      setModelName('');
      setModelLink('');
      setGenre('');
      setMood('');
      setTempo('');
      setKey('');
      setSeed('');
      setShowAdvanced(false);
      setUploading(false);
      setConfirmAdult(false);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 驗證檔案類型
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('❌ 只支持 MP3、WAV、FLAC 格式！');
      e.target.value = '';
      return;
    }

    // 驗證檔案大小（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(`❌ 檔案過大！最大 10MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('請選擇音樂檔案');
      return;
    }
    if (!title || !title.trim()) {
      toast.error('請輸入標題');
      return;
    }
    if (!category) {
      toast.error('請選擇分類');
      return;
    }
    if (rating === '18' && !confirmAdult) {
      toast.error('請勾選成年聲明');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags);
      formData.append('rating', rating);
      formData.append('category', category);

      if (platform) formData.append('platform', platform);
      if (prompt) formData.append('prompt', prompt);
      if (modelName) formData.append('modelName', modelName);
      if (modelLink) formData.append('modelLink', modelLink);
      if (genre) formData.append('genre', genre);
      if (mood) formData.append('mood', mood);
      if (tempo) formData.append('tempo', tempo);
      if (key) formData.append('key', key);
      if (seed) formData.append('seed', seed);

      const response = await fetch('/api/music/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        const completeness = result.music?.completenessScore || 0;
        toast.success(`✅ 音樂上傳成功！完整度：${completeness}分`);
        setIsOpen(false);
        window.location.href = '/music';
      } else {
        toast.error(result.error || '上傳失敗');
      }
    } catch (error) {
      console.error('上傳失敗:', error);
      toast.error('上傳失敗，請重試');
    } finally {
      setUploading(false);
    }
  };

  const getRatingColor = () => {
    if (rating === '18') return 'bg-red-600';
    if (rating === '15') return 'bg-orange-500';
    return 'bg-green-600';
  };

  if (!mounted || !isOpen) return null;

  const panel = (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-[9999]">
      {/* 背景 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* 面板容器 */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="relative w-full max-w-2xl bg-[#121212] rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[#121212]/90 backdrop-blur border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-center flex-1">
                <div className="text-lg font-semibold">🎵 上傳音樂</div>
                <div className="text-xs text-zinc-400 mt-1">最大 10MB，建議 2-5 分鐘</div>
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
            {/* 檔案選擇 */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-300 font-semibold">
                上傳音樂檔案
              </label>
              <input
                type="file"
                className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/flac"
                onChange={handleFileChange}
              />
            </div>

            {/* 檔案資訊 */}
            {file && (
              <div className="bg-zinc-800 rounded p-3 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">🎵</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{file.name}</div>
                    <div className="text-xs text-zinc-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 分級 */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className={`text-xl font-bold px-4 py-2 rounded text-white inline-block ${getRatingColor()}`}>
                  {rating === 'all' ? '一般 All' : rating === '15' ? '15+ 清涼' : '18+ 限制'}
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

            {/* 18+ 成年聲明 */}
            {rating === '18' && (
              <div className="space-y-2 border border-red-500/40 rounded-lg p-3 bg-red-900/20">
                <div className="text-sm text-red-300 font-semibold">18+ 成年聲明（必勾）</div>
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
              <div>
                <label className={`text-sm font-semibold ${category === '' ? 'text-red-400' : 'text-zinc-400'}`}>
                  📁 音樂分類（必選）
                </label>
                <select
                  className={`p-2 rounded w-full bg-zinc-700 text-white ${category === '' ? 'border border-red-500' : ''}`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="" disabled hidden>
                    請選擇分類
                  </option>
                  {MUSIC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
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

            {/* 進階參數（可折疊） */}
            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                <span>進階參數（提升完整度）</span>
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-3">
                  <textarea
                    placeholder="生成提示詞（Prompt）"
                    className="w-full p-2 rounded bg-zinc-700 text-white h-24"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  
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
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="曲風（Genre）"
                      className="p-2 rounded bg-zinc-700 text-white"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="情緒（Mood）"
                      className="p-2 rounded bg-zinc-700 text-white"
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                    />
                  </div>
                  
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
                  
                  <div className="text-xs text-zinc-400 bg-blue-500/10 border border-blue-500/30 rounded p-2">
                    💡 填寫越多參數，完整度分數越高，作品會在「創作參考」中獲得更多曝光！
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#121212]/90 backdrop-blur border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file || !title}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '上傳中...' : '上傳音樂'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  if (!mounted) return null;

  return createPortal(panel, document.body);
}


'use client';

import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import VIDEO_CATEGORIES from '@/constants/videoCategories';

export default function EditVideoModal({ video, isOpen, onClose, onSuccess }) {
  const [mounted, setMounted] = useState(false);
  
  // 基本資訊
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('');
  const [category, setCategory] = useState('');
  
  // AI 生成元數據
  const [platform, setPlatform] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  
  // 生成參數
  const [fps, setFps] = useState('');
  const [resolution, setResolution] = useState('');
  const [steps, setSteps] = useState('');
  const [cfgScale, setCfgScale] = useState('');
  const [seed, setSeed] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => setMounted(true), []);

  // 當 video 資料載入時，填充表單
  useEffect(() => {
    if (video && isOpen) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setTags(Array.isArray(video.tags) ? video.tags.join(', ') : '');
      setRating(video.rating || '');
      setCategory(video.category || '');
      setPlatform(video.platform || '');
      setPrompt(video.prompt || '');
      setNegativePrompt(video.negativePrompt || '');
      setFps(video.fps || '');
      setResolution(video.resolution || '');
      setSteps(video.steps || '');
      setCfgScale(video.cfgScale || '');
      setSeed(video.seed || '');
    }
  }, [video, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('請輸入影片標題');
      return;
    }

    if (!rating) {
      toast.error('請選擇分級');
      return;
    }

    setUpdating(true);

    try {
      const formData = {
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean),
        rating,
        category,
        platform: platform.trim(),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        fps: fps.trim(),
        resolution: resolution.trim(),
        steps: steps.trim(),
        cfgScale: cfgScale.trim(),
        seed: seed.trim(),
      };

      const response = await fetch(`/api/videos/${video._id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '更新失敗');
      }

      toast.success('✅ 影片更新成功！');
      onSuccess?.(result.video);
      onClose();
    } catch (error) {
      console.error('更新影片錯誤:', error);
      toast.error(`❌ ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />

      {/* Modal 容器 */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-lg shadow-2xl p-6 my-8">
          <Dialog.Title className="text-2xl font-bold text-white mb-6">
            編輯影片
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本資訊 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">基本資訊</h3>

              {/* 標題 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  標題 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入影片標題"
                  required
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  placeholder="描述影片內容"
                />
              </div>

              {/* 分級 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  分級 <span className="text-red-500">*</span>
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">選擇分級</option>
                  <option value="all">全年齡</option>
                  <option value="15">15+</option>
                  <option value="18+">18+</option>
                </select>
              </div>

              {/* 分類 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  分類
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選擇分類</option>
                  {VIDEO_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 標籤 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  標籤
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="用逗號或空格分隔，例如：動畫, 特效, 3D"
                />
              </div>
            </div>

            {/* 進階選項 */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                {showAdvanced ? '▼' : '▶'} AI 生成參數（選填）
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-zinc-900 rounded-lg">
                  {/* 生成平台 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      生成平台
                    </label>
                    <input
                      type="text"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：Runway, Pika, Sora"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      正面提示詞
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                      placeholder="輸入生成影片的提示詞"
                    />
                  </div>

                  {/* Negative Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      負面提示詞
                    </label>
                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                      placeholder="輸入要避免的元素"
                    />
                  </div>

                  {/* 技術參數 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        FPS
                      </label>
                      <input
                        type="text"
                        value={fps}
                        onChange={(e) => setFps(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：24, 30, 60"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        解析度
                      </label>
                      <input
                        type="text"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：1920x1080"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Steps
                      </label>
                      <input
                        type="text"
                        value={steps}
                        onChange={(e) => setSteps(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：20, 50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        CFG Scale
                      </label>
                      <input
                        type="text"
                        value={cfgScale}
                        onChange={(e) => setCfgScale(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：7.5"
                      />
                    </div>
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Seed
                    </label>
                    <input
                      type="text"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如：123456789"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={updating}
                className="flex-1 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={updating}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? '更新中...' : '確認更新'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>,
    document.body
  );
}


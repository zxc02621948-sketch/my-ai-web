'use client';

import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import VIDEO_CATEGORIES from '@/constants/videoCategories';
import SelectField from '@/components/common/SelectField';

export default function EditVideoModal({ video, isOpen, onClose, onSuccess }) {
  const [mounted, setMounted] = useState(false);
  
  // 基本資訊
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('');
  const [category, setCategory] = useState(''); // 保持向後兼容
  const [categories, setCategories] = useState([]);
  
  // AI 生成元數據
  const [platform, setPlatform] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  
  // 生成參數
  const [fps, setFps] = useState('');
  const [resolution, setResolution] = useState('');
  const [aspectRatio, setAspectRatio] = useState('');
  
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
      setCategory(video.category || ''); // 保持向後兼容
      setCategories(Array.isArray(video.categories) ? video.categories : (video.category ? [video.category] : []));
      setPlatform(video.platform || '');
      setPrompt(video.prompt || '');
      setNegativePrompt(video.negativePrompt || '');
      setFps(video.fps || '');
      setResolution(video.resolution || '');
      setAspectRatio(video.aspectRatio || '');
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
        category: categories.length > 0 ? categories[0] : '', // 保持向後兼容
        categories: categories.slice(0, 3), // 最多3個
        platform: platform.trim(),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        fps: fps.trim(),
        resolution: resolution.trim(),
        aspectRatio: aspectRatio.trim(),
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
        <Dialog.Panel className="relative w-full max-w-3xl bg-[#1a1a1a] rounded-lg shadow-2xl p-6 my-8 md:max-h-[90vh]">
          <Dialog.Title className="text-2xl font-bold text-white mb-6">
            編輯影片
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6 grid gap-6 md:max-h-[70vh] md:overflow-y-auto md:pr-2">
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
                  <option value="sfw">全年齡</option>
                  <option value="15">15+</option>
                  <option value="18">18+</option>
                </select>
              </div>

              {/* 分類（可複選，最多3個） */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${categories.length === 0 ? 'text-gray-300' : 'text-gray-300'}`}>
                  📁 影片分類（可複選，最多3個）
                </label>
                <div
                  className={`max-h-32 overflow-y-auto rounded p-2 bg-zinc-800 border ${
                    categories.length === 0 ? 'border-zinc-700' : categories.length >= 3 ? 'border-yellow-500/50' : 'border-zinc-700'
                  }`}
                >
                  {VIDEO_CATEGORIES.map((categoryKey) => {
                    const isSelected = categories.includes(categoryKey);
                    const isDisabled = !isSelected && categories.length >= 3;
                    
                    return (
                      <label
                        key={categoryKey}
                        className={`flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-700/50 rounded px-2 ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={categoryKey}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (categories.length < 3) {
                                setCategories([...categories, categoryKey]);
                                // 同時更新 category 保持向後兼容
                                if (categories.length === 0) {
                                  setCategory(categoryKey);
                                }
                              }
                            } else {
                              const newCategories = categories.filter((c) => c !== categoryKey);
                              setCategories(newCategories);
                              // 更新 category 為第一個分類或空字串
                              setCategory(newCategories.length > 0 ? newCategories[0] : '');
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-white text-sm">
                          {categoryKey}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {categories.length > 0 && (
                  <div className="mt-1 text-xs text-zinc-400">
                    已選擇 {categories.length} / 3 個分類
                  </div>
                )}
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

              {/* 提示詞與負面提示詞 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-300">提示詞（Prompt）</label>
                  <textarea
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                    placeholder="描述你想要的畫面、風格、動作等"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-300">負面提示詞（Negative Prompt）</label>
                  <textarea
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                    placeholder="不想要出現的元素（如：模糊、雜訊、扭曲等）"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                  />
                </div>
              </div>

              {/* 生成平台 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🛠️ 生成平台
                </label>
                <SelectField
                  value={platform}
                  onChange={setPlatform}
                  placeholder="請選擇平台"
                  options={[
                    { value: 'SORA', label: 'SORA' },
                    { value: 'OiiOii', label: 'OiiOii' },
                    { value: 'SeaArt.ai', label: 'SeaArt.ai' },
                    { value: 'deevid.ai', label: 'deevid.ai' },
                    { value: 'Stable Video Diffusion', label: 'Stable Video Diffusion' },
                    { value: '即夢AI', label: '即夢AI' },
                    { value: '其他', label: '其他' },
                  ]}
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
                  {/* 技術參數 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">解析度（可修改，例如 720p、1024p）</label>
                      <input
                        type="text"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：720p、1024p"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">FPS（可選）</label>
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={fps}
                        onChange={(e) => setFps(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">縱橫比（Aspect Ratio）</label>
                      <input
                        type="text"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：16:9、9:16、1:1"
                      />
                    </div>
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



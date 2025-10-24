'use client';

import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import VIDEO_CATEGORIES from '@/constants/videoCategories';

export default function UploadVideoModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 步驟：1=選分級, 2=上傳和填寫
  
  // 基本資訊
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('sfw');
  const [category, setCategory] = useState('');
  const [videoWidth, setVideoWidth] = useState(null);
  const [videoHeight, setVideoHeight] = useState(null);
  
  // AI 生成元數據
  const [platform, setPlatform] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  
  // 生成參數
  const [duration, setDuration] = useState(null);
  const [fps, setFps] = useState('');
  const [resolution, setResolution] = useState('');
  const [steps, setSteps] = useState('');
  const [cfgScale, setCfgScale] = useState('');
  const [seed, setSeed] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmAdult, setConfirmAdult] = useState(false);

  // 每日上傳配額
  const [dailyQuota, setDailyQuota] = useState({ current: 0, limit: 5, remaining: 5 });

  useEffect(() => setMounted(true), []);

  // 監聽開啟事件
  useEffect(() => {
    const handleOpen = async () => {
      setIsOpen(true);
      
      // 獲取當前每日配額
      try {
        const response = await fetch('/api/user/daily-video-quota');
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
    window.addEventListener('openVideoUploadModal', handleOpen);
    return () => window.removeEventListener('openVideoUploadModal', handleOpen);
  }, []);

  // 關閉時重置表單
  useEffect(() => {
    if (!isOpen) {
      setStep(1); // 重置到第一步
      setFile(null);
      setPreview(null);
      setTitle('');
      setDescription('');
      setTags('');
      setRating('');
      setCategory('');
      setVideoWidth(null);
      setVideoHeight(null);
      setDuration(null);
      setPlatform('');
      setPrompt('');
      setNegativePrompt('');
      setFps('');
      setResolution('');
      setSteps('');
      setCfgScale('');
      setSeed('');
      setShowAdvanced(false);
      setUploading(false);
      setConfirmAdult(false);
    }
  }, [isOpen]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 驗證檔案類型
    const validTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('❌ 只支持 MP4、MOV、AVI、WebM 格式！');
      e.target.value = '';
      return;
    }

    // 驗證檔案大小（20MB）
    const maxSize = 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(`❌ 檔案過大！最大 20MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);

    // 生成預覽縮圖並取得影片尺寸
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onerror = (err) => {
      console.error('影片載入失敗:', err);
      toast.error('影片載入失敗，請重試');
      URL.revokeObjectURL(video.src);
    };
    
    video.onloadedmetadata = () => {
      // 保存影片尺寸
      const width = video.videoWidth;
      const height = video.videoHeight;
      
      console.log('✅ 成功獲取影片尺寸:', width, 'x', height);
      
      setVideoWidth(width);
      setVideoHeight(height);
      
      // 自動填入解析度欄位和時長
      if (width && height) {
        setResolution(`${width}x${height}`);
        console.log('✅ 自動填入解析度:', `${width}x${height}`);
      }
      
      // 獲取時長
      if (video.duration) {
        setDuration(video.duration);
        console.log('✅ 獲取時長:', video.duration.toFixed(2), '秒');
      }
      
      // 取第0.5秒的畫面作為預覽
      video.currentTime = Math.min(0.5, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      setPreview(canvas.toDataURL());
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('請選擇影片檔案');
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
      // 使用混合上傳方案
      const response = await fetch('/api/videos/upload-hybrid', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hybrid upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        const completeness = result.video?.completenessScore || 0;
        
        // 更新每日配額顯示
        if (result.dailyUploads) {
          setDailyQuota({
            current: result.dailyUploads.current,
            limit: result.dailyUploads.limit,
            remaining: result.dailyUploads.remaining
          });
          toast.success(`✅ 影片上傳成功！完整度：${completeness}分\n今日剩餘：${result.dailyUploads.remaining}/${result.dailyUploads.limit}`);
        } else {
          toast.success(`✅ 影片上傳成功！完整度：${completeness}分`);
        }
        
        setIsOpen(false);
        window.location.href = '/videos';
      } else {
        // 處理每日限制錯誤
        if (response.status === 429) {
          toast.error(`❌ ${result.error}\n${result.resetInfo || ''}`);
        } else {
          toast.error(result.error || '上傳失敗');
        }
      }

      return; // 提前返回，避免執行後面的舊邏輯

      // 舊的 Stream 上傳邏輯（保留作為備用）
      const streamResult = await uploadDirectlyToStream(file, title);
      
      if (!streamResult.success) {
        throw new Error(streamResult.error);
      }

      console.log('Direct Stream upload successful:', streamResult);

      // 上傳完成後，調用我們的 API 保存記錄
      const saveResponse = await fetch('/api/videos/save-stream-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId: streamResult.streamId,
          playbackUrl: streamResult.playbackUrl,
          title,
          description,
          category,
          rating,
          tags,
          platform,
          prompt,
          negativePrompt,
          fps,
          resolution,
          steps,
          cfgScale,
          seed,
          width: videoWidth,
          height: videoHeight,
          duration,
        }),
        credentials: 'include',
      });

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        throw new Error(`Save record failed: ${errorText}`);
      }

      const saveResult = await saveResponse.json();

      if (saveResult.success) {
        const completeness = saveResult.video?.completenessScore || 0;
        
        // 更新每日配額顯示
        if (saveResult.dailyUploads) {
          setDailyQuota({
            current: saveResult.dailyUploads.current,
            limit: saveResult.dailyUploads.limit,
            remaining: saveResult.dailyUploads.remaining
          });
          toast.success(`✅ 影片上傳成功！完整度：${completeness}分\n今日剩餘：${saveResult.dailyUploads.remaining}/${saveResult.dailyUploads.limit}`);
        } else {
          toast.success(`✅ 影片上傳成功！完整度：${completeness}分`);
        }
        
        setIsOpen(false);
        window.location.href = '/videos';
      } else {
        // 處理每日限制錯誤
        if (saveResponse.status === 429) {
          toast.error(`❌ ${saveResult.error}\n${saveResult.resetInfo || ''}`);
        } else {
          toast.error(saveResult.error || '保存記錄失敗');
        }
      }

    } catch (error) {
      console.error('上傳失敗:', error);
      toast.error('上傳失敗，請重試');
    } finally {
      setUploading(false);
    }
  };

  // 直接上傳到 Cloudflare Stream 的函數
  const uploadDirectlyToStream = async (file, title) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', title);

      console.log('Uploading directly to Cloudflare Stream...');

      // 注意：這裡需要你填入實際的 Account ID 和 API Token
      const ACCOUNT_ID = '5c6250a0576aa4ca0bb9cdf32be0bee1';
      const API_TOKEN = 'FDh62HwIzm31AhAY05nuaGfsF4B4z1q61onBT4-s';
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stream API error response:', errorData);
        throw new Error(`Stream API error: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Stream API success:', data);
      
      return {
        success: true,
        streamId: data.result.uid,
        playbackUrl: data.result.playback.hls,
      };
    } catch (error) {
      console.error('Direct Stream upload error:', error);
      return {
        success: false,
        error: error.message,
      };
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
                <div className="text-lg font-semibold">🎬 上傳影片</div>
                <div className="text-xs text-zinc-400 mt-1">最大 20MB，建議 10-20 秒短影片</div>
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
            {/* 步驟 1: 選擇分級（三個大按鈕） */}
            {step === 1 && (
              <div className="space-y-4 py-8">
                <h2 className="text-2xl font-bold text-white text-center">選擇影片分級</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => {
                      setRating('sfw');
                      setStep(2);
                    }}
                    className="p-6 rounded-lg text-white text-xl font-bold bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    一般（All）
                  </button>
                  <button
                    onClick={() => {
                      setRating('15');
                      setStep(2);
                    }}
                    className="p-6 rounded-lg text-white text-xl font-bold bg-yellow-500 hover:bg-yellow-600 transition-colors"
                  >
                    15+（輕限）
                  </button>
                  <button
                    onClick={() => {
                      setRating('18');
                      setStep(2);
                    }}
                    className="p-6 rounded-lg text-white text-xl font-bold bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    18+（限制）
                  </button>
                </div>
                <div className="text-sm text-zinc-400 text-center">
                  請選擇本次上傳影片的適合年齡分級，再進行後續填寫。
                </div>
              </div>
            )}

            {/* 步驟 2: 上傳和填寫 */}
            {step === 2 && (
              <>
                {/* 顯示已選分級 */}
                <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">已選分級:</span>
                    <div className={`text-sm font-bold px-3 py-1 rounded text-white ${getRatingColor()}`}>
                      {rating === 'sfw' ? '一般 All' : rating === '15' ? '15+ 清涼' : '18+ 限制'}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    重新選擇
                  </button>
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
                        我確認本次上傳內容<strong>僅描繪成年角色</strong>，不包含未成年人或未成年特徵。
                      </span>
                    </label>
                  </div>
                )}

                {/* 檔案選擇 */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-300 font-semibold">
                步驟 2: 上傳影片檔案 *
              </label>
              <input
                type="file"
                className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                accept="video/mp4,video/mov,video/avi,video/webm"
                onChange={handleFileChange}
              />
            </div>

            {/* 預覽 */}
            {preview && (
              <div className="space-y-2">
                <div className="rounded-lg overflow-hidden border border-white/10">
                  <img src={preview} alt="preview" className="w-full max-h-[30vh] object-contain" />
                </div>
                {file && (
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>檔案大小: {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    {videoWidth && videoHeight && (
                      <div className="text-green-400 font-semibold">
                        ✅ 解析度: {videoWidth} x {videoHeight}
                      </div>
                    )}
                    {duration && (
                      <div className="text-blue-400 font-semibold">
                        ⏱️ 時長: {duration.toFixed(2)} 秒
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 步驟 3: 基本資訊 */}
            {file && (
              <div className="space-y-4 pt-2 border-t border-zinc-700">
                <label className="text-sm text-zinc-300 font-semibold">
                  步驟 3: 填寫影片資訊
                </label>
                
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

                <div>
                  <label className={`text-sm font-semibold ${category === '' ? 'text-red-400' : 'text-zinc-400'}`}>
                    📁 影片分類（必選）
                  </label>
              <select
                className={`p-2 rounded w-full bg-zinc-700 text-white ${category === '' ? 'border border-red-500' : ''}`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="" disabled hidden>
                  請選擇分類
                </option>
                {VIDEO_CATEGORIES.map((cat) => (
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
                    <option value="Runway">Runway</option>
                    <option value="Pika">Pika</option>
                    <option value="Stable Video Diffusion">Stable Video Diffusion</option>
                    <option value="其他">其他</option>
                  </select>
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
                      
                      <textarea
                        placeholder="負面提示詞（Negative Prompt）"
                        className="w-full p-2 rounded bg-zinc-700 text-white h-20"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                      />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="FPS（幀率）"
                          className="p-2 rounded bg-zinc-700 text-white"
                          value={fps}
                          onChange={(e) => setFps(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="解析度（如 1920x1080）"
                          className="p-2 rounded bg-zinc-700 text-white"
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="number"
                          placeholder="Steps"
                          className="p-2 rounded bg-zinc-700 text-white"
                          value={steps}
                          onChange={(e) => setSteps(e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="CFG Scale"
                          className="p-2 rounded bg-zinc-700 text-white"
                          value={cfgScale}
                          onChange={(e) => setCfgScale(e.target.value)}
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
            )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#121212]/90 backdrop-blur border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file || !title}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '上傳中...' : '上傳影片'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  if (!mounted) return null;

  return createPortal(panel, document.body);
}


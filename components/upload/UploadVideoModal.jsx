'use client';

import { Dialog } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { notify } from '@/components/common/GlobalNotificationManager';
import VIDEO_CATEGORIES from '@/constants/videoCategories';
import SelectField from '@/components/common/SelectField';

const SUCCESS_MESSAGE_STORAGE_KEY = 'videoUploadSuccessMessage';

// ✅ Step 1: 上傳模式開關（從環境變數讀取，與圖片上傳一致）
const UPLOAD_MODE = process.env.NEXT_PUBLIC_UPLOAD_MODE || "vercel";
const IS_DIRECT_UPLOAD = UPLOAD_MODE === "direct";

export default function UploadVideoModal({
  isOpen,
  onClose,
  isVideoTab = true,
}) {
  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState(1); // 步驟：1=選分級, 2=上傳和填寫
  
  // 基本資訊
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('sfw');
  const [category, setCategory] = useState(''); // 保持向後兼容
  const [categories, setCategories] = useState([]);
  const [videoWidth, setVideoWidth] = useState(null);
  const [videoHeight, setVideoHeight] = useState(null);
  
  // AI 生成元數據
  const [platform, setPlatform] = useState('');
  const [customPlatform, setCustomPlatform] = useState(''); // 自定义平台名称
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  
  // 生成參數
  const [duration, setDuration] = useState(null);
  const [fps, setFps] = useState('');
  const [resolution, setResolution] = useState('');
  const [aspectRatio, setAspectRatio] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmAdult, setConfirmAdult] = useState(false);

  // 每日上傳配額
  const [dailyQuota, setDailyQuota] = useState({ current: 0, limit: 5, remaining: 5 });

  useEffect(() => setMounted(true), []);

  // 顯示重新整理後的成功提示
  useEffect(() => {
    if (!mounted) return;
    try {
      const rawMessage = sessionStorage.getItem(SUCCESS_MESSAGE_STORAGE_KEY);
      if (!rawMessage) return;
      sessionStorage.removeItem(SUCCESS_MESSAGE_STORAGE_KEY);
      let payload;
      try {
        payload = JSON.parse(rawMessage);
      } catch {
        payload = null;
      }
      if (payload && typeof payload === "object") {
        notify.success(payload.title ?? "上傳成功", payload.body ?? "");
      } else {
        notify.success("上傳成功", rawMessage);
      }
    } catch (error) {
      console.warn('讀取上傳成功提示失敗:', error);
    }
  }, [mounted]);

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  // 監聽開啟事件
  useEffect(() => {
    const handleOpen = async () => {
      setInternalOpen(true);
      
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
  }, [isOpen]);

  // 關閉時重置表單
  useEffect(() => {
    const shouldReset = typeof isOpen === 'boolean' ? !isOpen : !internalOpen;
    if (!shouldReset) return;

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
    setCustomPlatform('');
    setPrompt('');
    setNegativePrompt('');
    setFps('');
    setResolution('');
    setAspectRatio('');
    setShowAdvanced(false);
    setUploading(false);
    setConfirmAdult(false);
  }, [isOpen, internalOpen]);

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

    // ✅ 驗證檔案大小（提高限制以支持更大的影片檔案）
    // 注意：雖然上傳到 R2，但文件仍會經過 Vercel，所以受 Next.js 限制
    const maxSize = 100 * 1024 * 1024; // 100MB（提高限制以方便測試）
    if (selectedFile.size > maxSize) {
      toast.error(`❌ 檔案過大！最大 100MB，當前：${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);

    // 生成預覽縮圖並取得影片尺寸
    const video = document.createElement('video');
    video.preload = 'metadata';
    const videoUrl = URL.createObjectURL(selectedFile);
    
    video.onerror = () => {
      const error = video.error;
      let errorMessage = '影片載入失敗';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = '影片載入被中止';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = '影片載入時發生網絡錯誤';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = '影片解碼失敗，可能格式不支援或檔案損壞';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = '不支援的影片格式或編碼';
            break;
          default:
            errorMessage = `影片載入失敗 (錯誤代碼: ${error.code})`;
        }
        console.error('影片載入失敗:', {
          code: error.code,
          message: errorMessage
        });
      } else {
        console.error('影片載入失敗: 無法讀取影片檔案');
      }
      
      toast.error(errorMessage);
      URL.revokeObjectURL(videoUrl);
      setFile(null);
      setPreview(null);
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
        // 以影像的垂直像素作為 p 值（例：1080p、720p）
        setResolution(`${height}p`);
        console.log('✅ 自動填入解析度:', `${height}p`);
        
        // 自動填入縱橫比（化簡，例如 1920x1080 -> 16:9）
        try {
          const gcd = (a, b) => {
            let x = Math.abs(a), y = Math.abs(b);
            while (y) {
              const t = y;
              y = x % y;
              x = t;
            }
            return x || 1;
          };
          if (width > 0 && height > 0) {
            const g = gcd(width, height);
            const simpleW = Math.round(width / g);
            const simpleH = Math.round(height / g);
            const ratio = `${simpleW}:${simpleH}`;
            setAspectRatio((prev) => prev ? prev : ratio);
            console.log('✅ 自動填入縱橫比:', ratio);
          }
        } catch (e) {
          console.warn('計算縱橫比失敗:', e);
        }
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
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        setPreview(canvas.toDataURL());
      } catch (err) {
        console.error('生成預覽圖失敗:', err);
        toast.error('生成預覽圖失敗');
      } finally {
        URL.revokeObjectURL(videoUrl);
      }
    };
    
    video.src = videoUrl;
  };

  // ✅ Step 2: 直傳模式（實現）
  const uploadDirect = async (file, metadata) => {
    console.log("[VIDEO UPLOAD] direct mode enabled");
    
    try {
      // Step 2-1: 獲取 Presigned URL
      const urlRes = await fetch("/api/videos/upload-presigned-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
          metadata,
        }),
        credentials: "include",
      });

      if (!urlRes.ok) {
        let urlError;
        try {
          urlError = await urlRes.json();
        } catch {
          urlError = { error: `HTTP ${urlRes.status}: ${urlRes.statusText}` };
        }
        throw new Error(urlError.error || "無法獲取上傳 URL");
      }

      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.uploadUrl || !urlData.key) {
        throw new Error("無法獲取上傳 URL：API 響應格式錯誤");
      }

      const { uploadUrl, key, publicUrl } = urlData;
      console.log("[VIDEO UPLOAD] 獲取到 Presigned URL，key:", key);
      
      // ✅ 驗證：確保 uploadUrl 是 path-style（bucket 在 path 中，不在 host 中）
      const urlObj = new URL(uploadUrl);
      const isPathStyle = !urlObj.hostname.includes(process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'my-ai-web-media');
      console.log("[VIDEO UPLOAD] URL 驗證:", {
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        isPathStyle: isPathStyle || "無法驗證（缺少環境變數）",
        urlPreview: uploadUrl.substring(0, 120) + "...",
      });

      // Step 2-2: 直接上傳文件到 R2
      // ✅ 方案 A：不手動設置 Content-Type header，讓瀏覽器自動處理
      // presigned URL 簽名時只簽了 host，不包含 content-type，所以不會有簽名不匹配的問題
      // 🔴 關鍵：直接使用 uploadUrl，不要修改 path 或 host
      console.log("[VIDEO UPLOAD] 準備上傳到 R2（不設置 Content-Type header，直接使用 uploadUrl）");
      
      let uploadRes;
      try {
        // ✅ 直接使用 uploadUrl，不做任何修改
        uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          // ✅ 不設置 Content-Type header，讓瀏覽器根據 file 自動設置
          // ✅ 不設置任何其他 header，避免影響簽名驗證
        });
      } catch (fetchError) {
        // ✅ 捕獲網絡錯誤（如 CORS、連接失敗等）
        console.error("[VIDEO UPLOAD] Fetch 錯誤：", fetchError);
        const errorMessage = fetchError.message || "網絡錯誤";
        throw new Error(`上傳失敗: ${errorMessage}`);
      }

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => "無法讀取錯誤信息");
        console.error("[VIDEO UPLOAD] R2 直傳失敗：", {
          status: uploadRes.status,
          statusText: uploadRes.statusText,
          error: errorText,
          uploadUrl: uploadUrl.substring(0, 100) + "...", // 只顯示前100字符，避免洩露完整URL
        });
        throw new Error(`上傳失敗: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`);
      }

      console.log("[VIDEO UPLOAD] R2 直傳成功，key:", key);

      // Step 2-3: 返回結果（包含 key 和 publicUrl，用於後續處理）
      return {
        key,
        publicUrl,
      };
    } catch (error) {
      console.error("[VIDEO UPLOAD] 直傳錯誤：", error);
      throw error;
    }
  };

  // ✅ Step 1: 舊流程（Vercel API 路由）
  const uploadViaVercelApi = async (file, metadata) => {
    // 建立 FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    // 直接上傳到後端，讓後端處理 R2 上傳、縮圖生成和 DB 寫入
    const uploadRes = await fetch('/api/videos/upload-r2-direct', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json();
      throw new Error(errorData.error || `上傳失敗 (${uploadRes.status})`);
    }

    const saveData = await uploadRes.json();
    return saveData;
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
    if (!categories || categories.length === 0) {
      toast.error('請選擇至少一個分類（最多3個）');
      return;
    }
    if (categories.length > 3) {
      toast.error('最多只能選擇3個分類');
      return;
    }
    if (!platform) {
      toast.error('請選擇生成平台');
      return;
    }
    if (platform === '其他' && !customPlatform?.trim()) {
      toast.error('請輸入平台名稱');
      return;
    }
    if (rating === '18' && !confirmAdult) {
      toast.error('請勾選成年聲明');
      return;
    }

    // ✅ 先檢查每日上傳限制（避免不必要的上傳和流量消耗）
    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    if (!token) {
      // 未登入：直接阻止上傳
      toast.error('請先登入後再上傳');
      return;
    }
    
    try {
      const quotaRes = await fetch("/api/user/daily-video-quota", {
        credentials: "include",
      });
      
      if (quotaRes.status === 401) {
        // 未登入：直接阻止上傳
        toast.error('請先登入後再上傳');
        return;
      }
      
      if (quotaRes.ok) {
        const quotaData = await quotaRes.json();
        if (quotaData.remaining <= 0) {
          throw new Error(`今日上傳限制為 ${quotaData.limit} 部，請明天再試`);
        }
      } else {
        // 其他錯誤（500等）：記錄但不阻止（避免檢查服務故障導致無法上傳）
        console.warn("⚠️ 上傳限制檢查失敗（繼續上傳）：", quotaRes.status);
      }
    } catch (quotaErr) {
      // 如果檢查失敗，記錄但不阻止（避免檢查服務故障導致無法上傳）
      // 但如果是明確的限制錯誤或登入錯誤，直接拋出
      if (quotaErr.message?.includes("今日上傳限制") || quotaErr.message?.includes("請先登入")) {
        toast.error(quotaErr.message);
        return;
      }
      console.warn("⚠️ 上傳限制檢查失敗（繼續上傳）：", quotaErr);
    }

    setUploading(true);

    try {
      // ✅ 使用新的 R2 API Token 方法：直接上傳到後端
      console.log('✅ 開始使用 R2 API Token 上傳...');

      // 準備 metadata
      const metadata = {
        title,
        description,
        tags,
        category: categories.length > 0 ? categories[0] : '', // 保持向後兼容
        categories,
        rating,
        platform: platform === '其他' ? (customPlatform?.trim() || '') : platform,
        prompt,
        negativePrompt,
        fps,
        resolution,
        aspectRatio,
        width: videoWidth,
        height: videoHeight,
        duration,
      };

      // 建立 FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify(metadata));

      console.log('🔍 上傳信息:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        metadata
      });

      // ✅ Step 1: 分流層 - 根據環境變數選擇上傳方式
      let saveData;
      if (IS_DIRECT_UPLOAD) {
        // 直傳模式：先直接上傳到 R2，然後處理縮圖和 DB
        console.log('🚀 開始直傳流程...');
        const uploadResult = await uploadDirect(file, metadata);
        
        // 直傳成功後，調用 API 處理縮圖生成和數據庫寫入
        const processRes = await fetch('/api/videos/process-after-direct-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoKey: uploadResult.key,
            videoUrl: uploadResult.publicUrl,
            metadata,
          }),
          credentials: 'include',
        });

        if (!processRes.ok) {
          const errorData = await processRes.json();
          throw new Error(errorData.error || `處理失敗 (${processRes.status})`);
        }

        saveData = await processRes.json();
        console.log('✅ 直傳流程完成:', saveData);
      } else {
        // 舊流程：通過 Vercel API 路由
        console.log('🚀 開始後端代理上傳流程...');
        saveData = await uploadViaVercelApi(file, metadata);
        console.log('✅ 後端代理上傳成功:', saveData);
      }

      const completeness = saveData.completenessScore || 0;
      
      // ✅ 根據完整度分數顯示不同的質量加成提示（與圖片上傳一致）
      let successBody;
      if (completeness >= 80) {
        successBody = "⭐ 此影片已標記為「優質影片」\n✨ 將獲得更多曝光機會\n🎓 其他用戶可以學習您的高質量生成參數";
      } else if (completeness >= 60) {
        successBody = "✓ 此影片已標記為「標準影片」\n✨ 將獲得適中的曝光機會\n📚 其他用戶可以參考您的生成參數";
      } else {
        successBody = "🎨 此影片已標記為「展示影片」\n📸 將出現在影片列表中供欣賞\n💡 建議填寫有意義的參數以獲得更多曝光";
      }

      // 更新每日配額顯示
      if (saveData.dailyUploads) {
        setDailyQuota({
          current: saveData.dailyUploads.current,
          limit: saveData.dailyUploads.limit,
          remaining: saveData.dailyUploads.remaining
        });
        successBody += `\n\n今日剩餘：${saveData.dailyUploads.remaining}/${saveData.dailyUploads.limit}`;
      }

      let storedMessage = false;
      try {
        const payload = {
          title: "✅ 上傳成功！",
          body: successBody,
          completeness: completeness,
        };
        sessionStorage.setItem(SUCCESS_MESSAGE_STORAGE_KEY, JSON.stringify(payload));
        storedMessage = true;
      } catch (error) {
        console.warn('儲存上傳成功提示失敗:', error);
      }

      if (!storedMessage) {
        notify.success("上傳成功", successBody, { autoClose: true, autoCloseDelay: 6000 });
      }

      handleClose();
      window.location.reload();
      // 使用者如需立即看到更新，提醒手動刷新頁面
      console.info('📦 影片上傳成功，已自動刷新列表。');
      if (saveData?.video?.thumbnailUrl) {
        console.log('🎬 縮圖 URL:', saveData.video.thumbnailUrl);
      } else {
        console.warn('⚠️ 後端未返回縮圖 URL');
      }

    } catch (error) {
      console.error('影片上傳失敗:', error);
      toast.error('❌ 上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };


  const getRatingColor = () => {
    if (rating === '18') return 'bg-red-600';
    if (rating === '15') return 'bg-orange-500';
    return 'bg-green-600';
  };

  const computedOpen = typeof isOpen === 'boolean' ? isOpen : internalOpen;
  const isModalOpen = mounted && computedOpen;

  if (!isModalOpen) return null;

  const panel = (
    <Dialog open={!!computedOpen} onClose={handleClose} className="relative z-[9999]">
      {/* 背景 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* 面板容器 */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <Dialog.Panel className="relative w-full max-w-2xl bg-[#121212] rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[#121212]/90 backdrop-blur border-b border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-center flex-1">
                <div className="text-lg font-semibold">上傳影片 +10／每日上限 {dailyQuota.limit}</div>
                <div className="text-xs text-zinc-400 mt-1">最大 100MB，建議 10-20 秒短影片</div>
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
                onClick={handleClose}
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
                <div className="pt-4 border-b border-zinc-700 pb-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm text-zinc-400 whitespace-nowrap">已選分級:</span>
                      <div className={`text-sm font-bold px-3 py-1 rounded text-white whitespace-nowrap ${getRatingColor()}`}>
                        {rating === 'sfw' ? '一般 All' : rating === '15' ? '15+ 清涼' : '18+ 限制'}
                      </div>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-purple-400 hover:text-purple-300 whitespace-nowrap flex-shrink-0"
                    >
                      重新選擇
                    </button>
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

                {/* 提示詞與負面提示詞 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-zinc-400">提示詞（Prompt）</label>
                    <textarea
                      className="w-full p-2 rounded bg-zinc-700 text-white h-24"
                      placeholder="描述你想要的畫面、風格、動作等"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-zinc-400">負面提示詞（Negative Prompt）</label>
                    <textarea
                      className="w-full p-2 rounded bg-zinc-700 text-white h-24"
                      placeholder="不想要出現的元素（如：模糊、雜訊、扭曲等）"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-sm font-semibold ${categories.length === 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                    📁 影片分類（可複選，最多3個）
                  </label>
                  <div
                    className={`max-h-32 overflow-y-auto rounded p-2 bg-zinc-700 ${
                      categories.length === 0 ? 'border border-red-500' : categories.length >= 3 ? 'border border-yellow-500/50' : 'border border-white/10'
                    }`}
                  >
                    {VIDEO_CATEGORIES.map((categoryKey) => {
                      const isSelected = categories.includes(categoryKey);
                      const isDisabled = !isSelected && categories.length >= 3;
                      
                      return (
                        <label
                          key={categoryKey}
                          className={`flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-600/50 rounded px-2 ${
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
                                }
                              } else {
                                setCategories(categories.filter((c) => c !== categoryKey));
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

                <div>
                  <label className={`text-sm font-semibold ${platform ? 'text-zinc-400' : 'text-red-400'}`}>
                    🛠️ 生成平台（必選）
                  </label>
                  <SelectField
                    value={platform}
                    onChange={setPlatform}
                    invalid={!platform}
                    placeholder="請選擇平台"
                    options={[
                      { value: 'SeaArt.ai', label: 'SeaArt.ai' },
                      { value: 'deevid.ai', label: 'deevid.ai' },
                      { value: 'Stable Video Diffusion', label: 'Stable Video Diffusion' },
                      { value: '即夢AI', label: '即夢AI' },
                      { value: '其他', label: '其他' },
                    ]}
                  />
                  {platform === '其他' && (
                    <input
                      type="text"
                      placeholder="請輸入平台名稱"
                      value={customPlatform}
                      onChange={(e) => setCustomPlatform(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded bg-zinc-700 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* 進階參數（可折疊） */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex w-full items-center justify-between text-sm text-zinc-300 hover:text-white"
                  >
                    <span className="flex items-center gap-2">
                      進階參數（提升完整度）
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-7.071 7.071a1 1 0 01-1.414 0L3.293 9.85a1 1 0 111.414-1.414l3.182 3.182 6.364-6.364a1 1 0 011.414 0z" />
                        </svg>
                        已自動偵測：解析度 / 縱橫比
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">{showAdvanced ? '收合' : '展開'}</span>
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* 已移除 Steps / CFG / Seed 欄位；保留可編輯的解析度與 FPS */}
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">解析度（可修改，例如 720p、1024p）</label>
                        <input
                          type="text"
                          className="w-full p-2 rounded bg-zinc-700 text-white"
                          placeholder="例如：720p、1024p"
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">FPS（可選）</label>
                        <input
                          type="number"
                          min="1"
                          max="240"
                          className="w-full p-2 rounded bg-zinc-700 text-white"
                          placeholder="例如：30"
                          value={fps}
                          onChange={(e) => setFps(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-400">縱橫比（Aspect Ratio）</label>
                        <input
                          type="text"
                          className="w-full p-2 rounded bg-zinc-700 text-white"
                          placeholder="例如：16:9、9:16、1:1"
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                        />
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


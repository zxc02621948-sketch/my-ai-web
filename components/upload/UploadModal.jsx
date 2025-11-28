"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { notify } from "@/components/common/GlobalNotificationManager";
import UploadStep1 from "./UploadStep1";
import UploadStep2 from "./UploadStep2";

const SUCCESS_MESSAGE_STORAGE_KEY = "imageUploadSuccessMessage";

export default function UploadModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [mobileSimple, setMobileSimple] = useState(false); // 手機簡化模式

  // 表單欄位
  const [rating, setRating] = useState("");
  const [platform, setPlatform] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(""); // 保持向後兼容
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState("");
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [compressedImage, setCompressedImage] = useState(null);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [modelLink, setModelLink] = useState("");
  const [loraLink, setLoraLink] = useState("");
  const [uploadLimits, setUploadLimits] = useState(null);

  useEffect(() => setMounted(true), []);

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
      console.warn("讀取圖片上傳成功提示失敗:", error);
    }
  }, [mounted]);

  // 行動視窗高修正（面板用）
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--app-vh", `${vh}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", setVH);
    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", setVH);
    };
  }, []);

  // 事件開啟（外部呼叫：window.dispatchEvent(new CustomEvent("openUploadModal", { detail: { user, mobileSimple } }))）
  useEffect(() => {
    const open = async (e) => {
      // 檢查是否為手機簡化模式
      const isMobileSimple = e?.detail?.mobileSimple || false;
      setMobileSimple(isMobileSimple);
      
      if (e?.detail?.user) {
        setCurrentUser(e.detail.user);
      }
      
      // ✅ 總是嘗試獲取上傳限制信息（不依賴 user 參數）
      try {
        const response = await fetch('/api/upload-limits', {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUploadLimits(data);
        } else if (response.status === 401) {
          // 未登入：清空配額顯示
          setUploadLimits(null);
        }
      } catch (error) {
        console.error('獲取上傳限制失敗：', error);
      }
      
      // 所有模式都需要先選擇分級（step 1）
      setStep(1);
      setIsOpen(true);
    };
    window.addEventListener("openUploadModal", open);
    return () => window.removeEventListener("openUploadModal", open);
  }, []);

  const onClose = () => setIsOpen(false);

  // 關閉時重置表單
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setMobileSimple(false);
      setRating("");
      setPlatform("");
      setTitle("");
      setDescription("");
      setCategory("");
      setCategories([]);
      setTags("");
      setPositivePrompt("");
      setNegativePrompt("");
      setImageFile(null);
      setCompressedImage(null);
      setCompressionInfo(null);
      setIsUploading(false);
      setPreview(null);
      setCurrentUser(null);
      setModelLink("");
      setLoraLink("");
      setUploadLimits(null);
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const panel = (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      {/* 背景 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* 外層容器：允許在小視窗時整個面板區域滾動 */}
      <div
        className="fixed inset-0 overflow-y-auto p-0 md:p-6"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
        }}
      >
        {/* 置中包一層（不使用 items-center 以避免溢出被夾住） */}
        <div className="min-h-full flex flex-col md:items-center md:justify-center">
          <Dialog.Panel
            className="
              w-full md:max-w-3xl
              bg-neutral-900 text-white
              rounded-none md:rounded-xl shadow-lg
              flex flex-col
              overflow-hidden
            "
            style={{
              // 手機：全螢幕高；桌機：最多 90vh
              height: "calc(var(--app-vh, 1vh) * 100)",
              maxHeight: "90vh",
            }}
          >
            {/* 頂部標題（sticky） */}
            <div className="shrink-0 sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-white/10">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <Dialog.Title className="text-lg md:text-xl font-bold">
                    上傳圖片 +5／每日上限 {uploadLimits?.dailyLimit || 20}
                  </Dialog.Title>
                  {uploadLimits && (
                    <div className="text-xs text-zinc-400 mt-1">
                      <span className={`font-medium ${(uploadLimits.dailyLimit - uploadLimits.todayUploads) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        今日配額：{uploadLimits.todayUploads} / {uploadLimits.dailyLimit} 張
                      </span>
                      {uploadLimits.isLimitReached && (
                        <span className="text-red-400 ml-2">（已達上限，明天重置）</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
                >
                  關閉
                </button>
              </div>
            </div>

            {/* 內容滾動區（真正可捲動的地方） */}
            <div className="flex-1 overflow-y-auto">
              {step === 1 && (
                <div className="px-6 py-4">
                  <UploadStep1 rating={rating} setRating={setRating} onNext={() => setStep(2)} />
                </div>
              )}

              {step === 2 && (
                // 讓子層吃滿父容器高度（UploadStep2 會用 h-full）
                <div className="h-full">
                  <UploadStep2
                    imageFile={imageFile}
                    setStep={setStep}
                    setImageFile={setImageFile}
                    compressedImage={compressedImage}
                    setCompressedImage={setCompressedImage}
                    compressionInfo={compressionInfo}
                    setCompressionInfo={setCompressionInfo}
                    title={title}
                    setTitle={setTitle}
                    platform={platform}
                    preview={preview}
                    setPreview={setPreview}
                    setPlatform={setPlatform}
                    description={description}
                    setDescription={setDescription}
                    category={category}
                    setCategory={setCategory}
                    categories={categories}
                    setCategories={setCategories}
                    tags={tags}
                    setTags={setTags}
                    rating={rating}
                    setRating={setRating}
                    positivePrompt={positivePrompt}
                    setPositivePrompt={setPositivePrompt}
                    negativePrompt={negativePrompt}
                    setNegativePrompt={setNegativePrompt}
                    isUploading={isUploading}
                    setIsUploading={setIsUploading}
                    onClose={onClose}
                    currentUser={currentUser}
                    modelLink={modelLink}
                    setModelLink={setModelLink}
                    loraLink={loraLink}
                    setLoraLink={setLoraLink}
                    uploadLimits={uploadLimits}
                    mobileSimple={mobileSimple}
                  />
                </div>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );

  // 用 Portal 掛到 <body>
  return createPortal(panel, document.body);
}

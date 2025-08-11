"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UploadStep1 from "./UploadStep1";
import UploadStep2 from "./UploadStep2";

export default function UploadModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  // 表單欄位
  const [rating, setRating] = useState("");
  const [platform, setPlatform] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [compressedImage, setCompressedImage] = useState(null);
  const [useOriginal, setUseOriginal] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [modelLink, setModelLink] = useState("");
  const [loraLink, setLoraLink] = useState("");

  useEffect(() => setMounted(true), []);

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

  // 事件開啟（外部呼叫：window.dispatchEvent(new CustomEvent("openUploadModal", { detail: { user } }))）
  useEffect(() => {
    const open = (e) => {
      if (e?.detail?.user) setCurrentUser(e.detail.user);
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
      setRating("");
      setPlatform("");
      setTitle("");
      setDescription("");
      setCategory("");
      setTags("");
      setPositivePrompt("");
      setNegativePrompt("");
      setImageFile(null);
      setCompressedImage(null);
      setUseOriginal(false);
      setCompressionInfo(null);
      setIsUploading(false);
      setPreview(null);
      setCurrentUser(null);
      setModelLink("");
      setLoraLink("");
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
                <Dialog.Title className="text-lg md:text-xl font-bold">圖片上傳</Dialog.Title>
                <button
                  onClick={onClose}
                  className="hidden md:inline-flex px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
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
                    useOriginal={useOriginal}
                    setUseOriginal={setUseOriginal}
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

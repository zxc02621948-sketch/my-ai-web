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

  // 事件開啟（Header 按鈕請 dispatch 這個事件）
  useEffect(() => {
    const open = (e) => {
      // console.log("[openUploadModal] fired", e?.detail);
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

  // ✅ 核心：沒開就完全不渲染 + 僅在前端掛載後才渲染
  if (!mounted || !isOpen) return null;

  const panel = (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-3xl mx-auto bg-neutral-900 text-white rounded-xl p-6 shadow-lg">
          <Dialog.Title className="text-xl font-bold mb-4">圖片上傳</Dialog.Title>

          {step === 1 && (
            <UploadStep1 rating={rating} setRating={setRating} onNext={() => setStep(2)} />
          )}

          {step === 2 && (
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
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  // 用 Portal 掛到 <body>，與 Header/頁面流完全脫鉤
  return createPortal(panel, document.body);
}

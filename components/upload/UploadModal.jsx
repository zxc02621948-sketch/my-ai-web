"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import UploadStep1 from "./UploadStep1";
import UploadStep2 from "./UploadStep2";

const UploadModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
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

  // ✅ 用事件觸發開啟 modal
  useEffect(() => {
    const open = (e) => {
      if (e.detail?.user) setCurrentUser(e.detail.user); // 可以額外傳使用者進來
      setIsOpen(true);
    };
    window.addEventListener("openUploadModal", open);
    return () => window.removeEventListener("openUploadModal", open);
  }, []);

  const onClose = () => setIsOpen(false);

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

  const handleNextStep = () => {
    setStep(2);
  };

  const handleUpload = () => {
    // TODO: 可加入 upload API 呼叫
    console.log("執行上傳邏輯...");
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-50 w-full max-w-3xl mx-auto bg-neutral-900 text-white rounded-xl p-6 shadow-lg">
          <Dialog.Title className="text-xl font-bold mb-4">圖片上傳</Dialog.Title>

          {step === 1 && (
            <UploadStep1
              rating={rating}
              setRating={setRating}
              onNext={handleNextStep}
            />
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
              onUpload={handleUpload}
              onClose={onClose}
              currentUser={currentUser}
              modelLink={modelLink}
              setModelLink={setModelLink}
              loraLink={loraLink}
              setLoraLink={setLoraLink}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default UploadModal;

import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

export default function UploadStep2({
  rating,
  setRating,
  setStep,
  imageFile,
  setImageFile,
  compressedImage,
  setCompressedImage,
  preview,
  setPreview,
  useOriginal,
  setUseOriginal,
  isUploading, 
  setIsUploading,
  onUpload,
  onClose,
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState(""); // 🔧 改為無預設
  const [platform, setPlatform] = useState("Stable Diffusion WebUI");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [modelName, setModelName] = useState("");
  const [loraName, setLoraName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  useEffect(() => {
    if (imageFile) {
      setPreview(URL.createObjectURL(imageFile));
      setOriginalSize(imageFile.size);
      compressImage(imageFile);
    }
  }, [imageFile]);

  const compressImage = async (originalFile) => {
    const img = new Image();
    img.src = URL.createObjectURL(originalFile);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1280;
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCompressedImage(new File([blob], originalFile.name, { type: "image/jpeg" }));
            setCompressedSize(blob.size);
          }
        },
        "image/jpeg",
        0.85
      );
    };
  };

  const getRatingColor = () => {
    switch (rating) {
      case "all": return "bg-green-600";
      case "15": return "bg-yellow-500";
      case "18": return "bg-red-600";
      default: return "bg-zinc-600";
    }
  };

  const handleUpload = async () => {
    if (!imageFile) return;
    if (!title.trim()) {
      alert("請輸入圖片標題！");
      return;
    }
    if (!category) {
      alert("請選擇圖片分類！");
      return;
    }

    setIsUploading(true);
    let imageId = null;

    try {
      const urlRes = await fetch("/api/cloudflare-upload-url", { method: "POST" });
      if (!urlRes.ok) throw new Error("Cloudflare upload URL API 回應失敗");

      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.uploadURL) throw new Error("無法取得上傳網址");

      const formData = new FormData();
      formData.append("file", useOriginal ? imageFile : compressedImage);

      const cloudflareRes = await fetch(urlData.uploadURL, { method: "POST", body: formData });
      const cloudflareData = await cloudflareRes.json();
      imageId = cloudflareData?.result?.id;
      if (!imageId) throw new Error("Cloudflare 上傳失敗");

      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;
      const tags = tagsInput.replace(/#/g, "").split(/[ ,，、]/).map(t => t.trim()).filter(t => t.length > 0);
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const decoded = token ? jwtDecode(token) : null;
      const userId = decoded?._id || decoded?.id || null;
      const username = decoded?.username || decoded?.name || null;

      const metadata = {
        imageId,
        imageUrl,
        title,
        author,
        category,
        rating,
        platform,
        modelName,
        loraName,
        positivePrompt: prompt,
        negativePrompt,
        description,
        tags,
        fileName: imageFile.name,
        userId,
        username,
        likes: 0,
      };

      const metaRes = await fetch("/api/cloudflare-images", {
        method: "POST",
        body: JSON.stringify(metadata),
        headers: { "Content-Type": "application/json" },
      });

      if (!metaRes.ok) throw new Error("Metadata 上傳失敗");

      setStep(1);
      onClose();
      if (onUpload) onUpload(1);
    } catch (err) {
      console.error("上傳失敗：", err);
      alert("上傳失敗，請稍後再試！");
      if (imageId) {
        try {
          await fetch(`/api/delete-cloudflare-image?id=${imageId}`, { method: "DELETE" });
        } catch (delErr) {
          console.error("❌ 刪除殘影圖片失敗：", delErr);
        }
      }
    }
    setIsUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`text-xl font-bold px-4 py-2 rounded text-white inline-block ${getRatingColor()}`}>
          目前選擇：{rating === "all" ? "一般 All" : rating === "15" ? "15+ 清涼" : "18+ 限制"}
        </div>
        <select
          className="p-2 rounded bg-zinc-700"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        >
          <option value="all">一般（All）</option>
          <option value="15">15+（清涼）</option>
          <option value="18">18+（限制）</option>
        </select>
      </div>

      <input type="text" placeholder="標題" className="w-full p-2 rounded bg-zinc-700" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="作者（選填）" className="w-full p-2 rounded bg-zinc-700" value={author} onChange={(e) => setAuthor(e.target.value)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            className={`text-sm font-semibold ${
              category === "" ? "text-red-400" : "text-zinc-400"
            }`}
          >
            📁 圖片分類（必選）
          </label>
          <select
            className={`p-2 rounded w-full bg-zinc-700 ${
              category === "" ? "border border-red-500" : ""
            }`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled hidden>請選擇分類</option>
            <option value="人物">人物</option>
            <option value="風景">風景</option>
            <option value="食物">食物</option>
            <option value="動漫">動漫</option>
            <option value="物品">物品</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-zinc-400">🛠️ 使用平台</label>
          <select className="p-2 rounded bg-zinc-700 w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="Stable Diffusion WebUI">Stable Diffusion WebUI</option>
            <option value="ComfyUI">ComfyUI</option>
            <option value="GPT 生圖">GPT 生圖</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      <textarea placeholder="正面提詞（Prompt）" className="w-full p-2 rounded bg-zinc-700 h-20" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <textarea placeholder="負面提詞（Negative Prompt）" className="w-full p-2 rounded bg-zinc-700 h-20" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
      <input type="text" placeholder="模型名稱（選填）" className="w-full p-2 rounded bg-zinc-700" value={modelName} onChange={(e) => setModelName(e.target.value)} />
      <input type="text" placeholder="LoRA 名稱（選填）" className="w-full p-2 rounded bg-zinc-700" value={loraName} onChange={(e) => setLoraName(e.target.value)} />
      <textarea placeholder="內文說明（可選填）" className="w-full p-2 rounded bg-zinc-700 h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input type="text" placeholder="標籤（空格 / # 分隔）" className="w-full p-2 rounded bg-zinc-700" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />

      <input type="file" className="w-full" onChange={(e) => setImageFile(e.target.files[0])} />

      {preview && (
        <div className="pt-2 space-y-2">
          <img src={preview} alt="預覽" className="w-full max-h-60 object-contain rounded" />
          <div className="text-sm text-zinc-400">
            原圖大小：{(originalSize / 1024 / 1024).toFixed(2)} MB
            <br />
            壓縮後：{(compressedSize / 1024 / 1024).toFixed(2)} MB
          </div>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2">
              <input type="radio" name="uploadMode" checked={!useOriginal} onChange={() => setUseOriginal(false)} />
              使用壓縮圖（推薦）
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="uploadMode" checked={useOriginal} onChange={() => setUseOriginal(true)} />
              上傳原圖（需消耗積分）
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={() => setStep(1)} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700" disabled={isUploading}>返回</button>
        <button onClick={handleUpload} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700" disabled={isUploading || !imageFile}>
          {isUploading ? "上傳中..." : "上傳"}
        </button>
      </div>
    </div>
  );
}

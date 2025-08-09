import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

export default function UploadStep2({
  // 來自父層的狀態與 setter
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
  compressionInfo,
  setCompressionInfo,
  title,
  setTitle,
  platform,
  setPlatform,
  description,
  setDescription,
  category,
  setCategory,
  tags,                // 父層存的「標籤字串」
  setTags,             // 父層 setter
  positivePrompt,
  setPositivePrompt,
  negativePrompt,
  setNegativePrompt,
  isUploading,
  setIsUploading,
  onUpload,
  onClose,
  currentUser,

  // ✅ 新增：父層控管的 civitai 連結
  modelLink,
  setModelLink,
  loraLink,
  setLoraLink,
}) {
  // 本地端控管的欄位（父層沒有的）
  const [author, setAuthor] = useState("");
  const [modelName, setModelName] = useState("");
  const [loraName, setLoraName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreview(url);
      setOriginalSize(imageFile.size);
      compressImage(imageFile);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  const compressImage = async (originalFile) => {
    const img = new Image();
    img.src = URL.createObjectURL(originalFile);
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1280;
      const scaleSize = Math.min(1, MAX_WIDTH / img.width);
      canvas.width = Math.floor(img.width * scaleSize);
      canvas.height = Math.floor(img.height * scaleSize);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const f = new File([blob], originalFile.name, { type: "image/jpeg" });
            setCompressedImage(f);
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

  const civitaiRegex = /^https?:\/\/(www\.)?civitai\.com(\/|$)/i;

  const handleUpload = async () => {
    if (!imageFile) return;

    if (!title || !title.trim()) {
      alert("請輸入圖片標題！");
      return;
    }
    if (!category) {
      alert("請選擇圖片分類！");
      return;
    }

    // ✅ 僅允許 civitai.com 網址（可空白）
    if (modelLink && !civitaiRegex.test(modelLink)) {
      alert("模型連結僅允許填寫 civitai.com 網址。");
      return;
    }
    if (loraLink && !civitaiRegex.test(loraLink)) {
      alert("LoRA 連結僅允許填寫 civitai.com 網址。");
      return;
    }

    setIsUploading(true);
    let imageId = null;

    try {
      // 1) 取得 Cloudflare 上傳 URL
      const urlRes = await fetch("/api/cloudflare-upload-url", { method: "POST" });
      if (!urlRes.ok) throw new Error("Cloudflare upload URL API 回應失敗");

      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.uploadURL) throw new Error("無法取得上傳網址");

      // 2) 上傳圖片（壓縮或原檔）
      const formData = new FormData();
      formData.append("file", useOriginal ? imageFile : compressedImage);

      const cloudflareRes = await fetch(urlData.uploadURL, { method: "POST", body: formData });
      const cloudflareData = await cloudflareRes.json();
      imageId = cloudflareData?.result?.id;
      if (!imageId) throw new Error("Cloudflare 上傳失敗");

      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

      // 3) 解析使用者資訊
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const decoded = token ? jwtDecode(token) : null;
      const userId = decoded?._id || decoded?.id || null;
      const username = decoded?.username || decoded?.name || null;

      // 4) tags（父層字串 → 陣列）
      const tagsArray = (tags || "")
        .replace(/#/g, "")
        .split(/[ ,，、]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // 5) 準備 metadata（✅ 帶上 modelLink / loraLink）
      const metadata = {
        imageId,
        imageUrl,
        title: title?.trim(),
        author: author?.trim() || "",
        category,
        rating,
        platform: platform?.trim() || "Stable Diffusion WebUI",
        modelName: modelName?.trim() || "",
        loraName: loraName?.trim() || "",
        modelLink: modelLink?.trim() || "",
        loraLink: loraLink?.trim() || "",
        positivePrompt,
        negativePrompt,
        description,
        tags: tagsArray,
        fileName: imageFile.name,
        userId,
        username,
        likes: 0,
      };

      // 6) 上傳 metadata
      const metaRes = await fetch("/api/cloudflare-images", {
        method: "POST",
        body: JSON.stringify(metadata),
        headers: { "Content-Type": "application/json" },
      });
      if (!metaRes.ok) throw new Error("Metadata 上傳失敗");

      // 7) 完成後復位
      setStep(1);
      onClose?.();
      location.reload();
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
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 分級選擇 */}
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
          <option value="15">15+（輕限）</option>
          <option value="18">18+（限制）</option>
        </select>
      </div>

      {/* 基本資訊 */}
      <input
        type="text"
        placeholder="標題"
        className="w-full p-2 rounded bg-zinc-700"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="text"
        placeholder="來源作者（選填）"
        className="w-full p-2 rounded bg-zinc-700"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            className={`text-sm font-semibold ${category === "" ? "text-red-400" : "text-zinc-400"}`}
          >
            📁 圖片分類（必選）
          </label>
          <select
            className={`p-2 rounded w-full bg-zinc-700 ${category === "" ? "border border-red-500" : ""}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled hidden>請選擇分類</option>
            <option value="人物">人物</option>
            <option value="風景">風景</option>
            <option value="食物">食物</option>
            <option value="動漫">動漫</option>
            <option value="物品">物品</option>
            <option value="藝術">藝術</option>
            <option value="其他">其他</option>
            <option value="動物">動物</option>
          </select>

        </div>
        <div>
          <label className="text-sm text-zinc-400">🛠️ 使用平台</label>
          <select
            className="p-2 rounded bg-zinc-700 w-full"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="Stable Diffusion WebUI">Stable Diffusion WebUI</option>
            <option value="ComfyUI">ComfyUI</option>
            <option value="GPT 生圖">GPT 生圖</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      {/* 提詞 */}
      <textarea
        placeholder="正面提詞（Prompt）"
        className="w-full p-2 rounded bg-zinc-700 h-20"
        value={positivePrompt}
        onChange={(e) => setPositivePrompt(e.target.value)}
      />
      <textarea
        placeholder="負面提詞（Negative Prompt）"
        className="w-full p-2 rounded bg-zinc-700 h-20"
        value={negativePrompt}
        onChange={(e) => setNegativePrompt(e.target.value)}
      />

      {/* 模型 / LoRA 名稱 */}
      <input
        type="text"
        placeholder="模型名稱（選填）"
        className="w-full p-2 rounded bg-zinc-700"
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
      />      
      {/* ✅ civitai.com 連結（僅允許 civitai） */}
      <input
        type="text"
        placeholder="模型 civitai 連結（可選）"
        className="w-full p-2 rounded bg-zinc-700"
        value={modelLink}
        onChange={(e) => setModelLink(e.target.value)}
      />
      <input
        type="text"
        placeholder="LoRA 名稱（選填）"
        className="w-full p-2 rounded bg-zinc-700"
        value={loraName}
        onChange={(e) => setLoraName(e.target.value)}
      />
      <input
        type="text"
        placeholder="LoRA civitai 連結（可選）"
        className="w-full p-2 rounded bg-zinc-700"
        value={loraLink}
        onChange={(e) => setLoraLink(e.target.value)}
      />
      <p className="text-xs text-zinc-400">
        只接受 <span className="underline">civitai.com</span> 的網址（可留白）。
      </p>

      {/* 標籤與描述 */}
      <input
        type="text"
        placeholder="標籤（以空格或逗號分隔，例如：可愛 貓耳 女僕）"
        className="w-full p-2 rounded bg-zinc-700"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <textarea
        placeholder="描述（選填）"
        className="w-full p-2 rounded bg-zinc-700 h-28"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* 上傳圖片 */}
      <input
        type="file"
        className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files[0]) {
            setImageFile(e.target.files[0]);
          }
        }}
      />

      {/* 預覽與上傳 */}
      {preview && (
        <div className="rounded-lg overflow-hidden border border-white/10">
          <img src={preview} alt="preview" className="w-full object-contain" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {useOriginal ? "使用原檔上傳" : "使用壓縮圖上傳"}
          {originalSize ? `｜原檔 ${(originalSize / 1024 / 1024).toFixed(2)} MB` : ""}
          {compressedSize ? `｜壓縮 ${(compressedSize / 1024 / 1024).toFixed(2)} MB` : ""}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">
            <input
              type="checkbox"
              className="mr-1 align-middle"
              checked={useOriginal}
              onChange={(e) => setUseOriginal(e.target.checked)}
            />
            使用原檔
          </label>
          <button
            disabled={isUploading}
            onClick={handleUpload}
            className={`px-4 py-2 rounded text-white ${isUploading ? "bg-zinc-600" : "bg-blue-600 hover:bg-blue-700"} transition`}
          >
            {isUploading ? "上傳中..." : "上傳"}
          </button>
        </div>
      </div>
    </div>
  );
}

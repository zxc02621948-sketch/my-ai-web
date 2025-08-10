import { useState, useEffect, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import CATEGORIES from "@/constants/categories";

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
  tags,
  setTags,
  positivePrompt,
  setPositivePrompt,
  negativePrompt,
  setNegativePrompt,
  isUploading,
  setIsUploading,
  onUpload,
  onClose,
  currentUser,
  modelLink,
  setModelLink,
  loraLink,
  setLoraLink,
}) {
  // local only
  const [author, setAuthor] = useState("");
  const [modelName, setModelName] = useState("");
  const [loraName, setLoraName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  // advanced
  const [steps, setSteps] = useState("");
  const [sampler, setSampler] = useState("");
  const [cfgScale, setCfgScale] = useState("");
  const [seed, setSeed] = useState("");
  const [clipSkip, setClipSkip] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [modelHash, setModelHash] = useState("");

  // ui
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null); // null | 'found' | 'none' | 'error'
  const [pasteInfo, setPasteInfo] = useState("");

  const getRatingColor = () => {
    switch (rating) {
      case "all": return "bg-green-600";
      case "15": return "bg-yellow-500";
      case "18": return "bg-red-600";
      default: return "bg-zinc-600";
    }
  };

  // ------------------ metadata ------------------
  const textDecoder = useMemo(() => new TextDecoder("utf-8"), []);

  async function extractPngTextChunks(file) {
    const ab = await file.arrayBuffer();
    const dv = new DataView(ab);
    const sig = [137,80,78,71,13,10,26,10];
    for (let i = 0; i < sig.length; i++) if (dv.getUint8(i) !== sig[i]) return {};
    let pos = 8;
    const out = {};
    while (pos + 8 <= dv.byteLength) {
      const length = dv.getUint32(pos);
      const type = String.fromCharCode(
        dv.getUint8(pos + 4),
        dv.getUint8(pos + 5),
        dv.getUint8(pos + 6),
        dv.getUint8(pos + 7)
      );
      const dataStart = pos + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > dv.byteLength) break;
      if (type === "tEXt") {
        const raw = new Uint8Array(ab, dataStart, length);
        const idx = raw.indexOf(0);
        const key = textDecoder.decode(raw.slice(0, Math.max(0, idx)));
        const val = textDecoder.decode(raw.slice(idx + 1));
        out[key] = val;
      } else if (type === "iTXt") {
        const raw = new Uint8Array(ab, dataStart, length);
        let p = 0;
        const readToNull = () => {
          const start = p;
          while (p < raw.length && raw[p] !== 0) p++;
          const s = textDecoder.decode(raw.slice(start, p));
          p++;
          return s;
        };
        const key = readToNull();
        const compressionFlag = raw[p++];
        p++; // compressionMethod
        readToNull(); // languageTag
        readToNull(); // translatedKeyword
        let text = "";
        if (compressionFlag === 0) text = textDecoder.decode(raw.slice(p));
        if (key) out[key] = text;
      }
      pos = dataEnd + 4; // skip CRC
      if (type === "IEND") break;
    }
    return out;
  }

  function parseA1111Parameters(parameters) {
    if (!parameters) return null;
    const lines = parameters.split(/\r?\n/);
    const firstLine = lines[0] || "";
    let full = parameters;

    // split prompt / negative
    let posPrompt = firstLine;
    let posNegative = "";
    const negIdx = parameters.indexOf("Negative prompt:");
    if (negIdx !== -1) {
      posPrompt = parameters.slice(0, negIdx).trim();
      const rest = parameters.slice(negIdx + "Negative prompt:".length);
      const nl = rest.indexOf("\n");
      posNegative = nl !== -1 ? rest.slice(0, nl).trim() : rest.trim();
      full = parameters.slice(nl !== -1 ? negIdx + "Negative prompt:".length + nl + 1 : parameters.length);
    } else {
      full = parameters.slice(firstLine.length);
    }

    const get = (re) => {
      const m = full.match(re);
      return m ? m[1].trim() : "";
    };

    // lora names
    const loraSet = new Set();
    // 1) "Lora: name:0.8" / "LoRA: name"
    const rx1 = /(?:^|[\s,])(?:Lora|LoRA):\s*([^:,\n<>]+)(?::[^,\n]+)?/gi;
    let mm;
    while ((mm = rx1.exec(parameters)) !== null) {
      const name = mm[1].trim();
      if (name) loraSet.add(name);
    }
    // 2) "<lora:name:0.8>" inside prompt
    const rx2 = /<lora:([^:>]+):[^>]*>/gi;
    while ((mm = rx2.exec(parameters)) !== null) {
      const name = mm[1].trim();
      if (name) loraSet.add(name);
    }

    const out = {
      prompt: posPrompt,
      negative: posNegative,
      steps: get(/Steps:\s*(\d+)/i),
      sampler: get(/Sampler:\s*([^,\n]+)/i),
      cfgScale: get(/CFG scale:\s*([\d.]+)/i),
      seed: get(/Seed:\s*([^,\n]+)/i),
      size: get(/Size:\s*(\d+)x(\d+)/i),
      clipSkip: get(/Clip skip:\s*(\d+)/i),
      modelHash: get(/Model hash:\s*([^,\n]+)/i),
      model: get(/Model:\s*([^,\n]+)/i),
      loras: Array.from(loraSet),
    };

    if (out.size) {
      const m = out.size.match(/(\d+)x(\d+)/);
      if (m) { out.width = m[1]; out.height = m[2]; }
    }

    return out;
  }

  function tryParseComfy(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const out = {};
      if (data && typeof data === "object") {
        const text = JSON.stringify(data);
        const gr = (re) => (text.match(re)?.[1] || "");
        out.seed = gr(/"seed"\s*:\s*(\d+)/i);
        out.cfgScale = gr(/"cfg"\s*:\s*([\d.]+)/i);
        out.sampler = gr(/"sampler(?:_name)?"\s*:\s*"([^"]+)"/i);
        out.width = gr(/"width"\s*:\s*(\d+)/i);
        out.height = gr(/"height"\s*:\s*(\d+)/i);
        const loras = new Set();
        const rx = /"(?:lora|lora_name|lora_model)"\s*:\s*"([^"]+)"/gi;
        let m;
        while ((m = rx.exec(text)) !== null) {
          const name = m[1].trim();
          if (name) loras.add(name);
        }
        if (loras.size) out.loras = Array.from(loras);
      }
      return out;
    } catch { return null; }
  }

  function applyParsed(parsed) {
    if (!parsed) return;
    if (typeof parsed.prompt === "string") setPositivePrompt(parsed.prompt);
    if (typeof parsed.negative === "string") setNegativePrompt(parsed.negative);
    setSteps(parsed.steps || "");
    setSampler(parsed.sampler || "");
    setCfgScale(parsed.cfgScale || "");
    setSeed(parsed.seed || "");
    setClipSkip(parsed.clipSkip || "");
    setWidth(parsed.width || "");
    setHeight(parsed.height || "");
    setModelName(parsed.model || "");
    setModelHash(parsed.modelHash || "");
    if (Array.isArray(parsed.loras) && parsed.loras.length) setLoraName(parsed.loras.join(", "));
  }

  useEffect(() => {
    let revokeUrl = null;
    const run = async () => {
      if (!imageFile) return;
      // clear previous values to avoid carry-over when switching images
      setMetaStatus(null);
      setPositivePrompt("");
      setNegativePrompt("");
      setSteps("");
      setSampler("");
      setCfgScale("");
      setSeed("");
      setClipSkip("");
      setWidth("");
      setHeight("");
      setModelName("");
      setModelHash("");
      setLoraName("");

      const url = URL.createObjectURL(imageFile);
      revokeUrl = url;
      setPreview(url);
      setOriginalSize(imageFile.size);

      try {
        let parsed = null;
        if (imageFile.type === "image/png") {
          const chunks = await extractPngTextChunks(imageFile);
          if (chunks.parameters) {
            parsed = parseA1111Parameters(chunks.parameters);
          } else if (chunks.prompt) {
            const comfy = tryParseComfy(chunks.prompt);
            if (comfy) parsed = comfy;
          } else if (chunks.workflow) {
            const comfy = tryParseComfy(chunks.workflow);
            if (comfy) parsed = comfy;
          }
        }
        if (parsed) {
          applyParsed(parsed);
          setMetaStatus("found");
          setShowAdvanced(true);
        } else {
          setMetaStatus("none");
        }
      } catch (e) {
        console.warn("PNG metadata parse failed", e);
        setMetaStatus("error");
      }

      compressImage(imageFile);
    };
    run();
    return () => { if (revokeUrl) URL.revokeObjectURL(revokeUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const civitaiRegex = /^https?:\/\/(www\.)?civitai\.com(\/|$)/i;

  const handleUpload = async () => {
    if (!imageFile) return;

    if (!title || !title.trim()) { alert("請輸入圖片標題！"); return; }
    if (!category) { alert("請選擇圖片分類！"); return; }

    if (modelLink && !civitaiRegex.test(modelLink)) { alert("模型連結僅允許 civitai.com 網址。"); return; }
    if (loraLink && !civitaiRegex.test(loraLink)) { alert("LoRA 連結僅允許 civitai.com 網址。"); return; }

    setIsUploading(true);
    let imageId = null;

    try {
      // 1) get upload url
      const urlRes = await fetch("/api/cloudflare-upload-url", { method: "POST" });
      if (!urlRes.ok) throw new Error("Cloudflare upload URL API error");
      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.uploadURL) throw new Error("No uploadURL received");

      // 2) upload image
      const formData = new FormData();
      formData.append("file", useOriginal ? imageFile : compressedImage);
      const cloudflareRes = await fetch(urlData.uploadURL, { method: "POST", body: formData });
      const cloudflareData = await cloudflareRes.json();
      imageId = cloudflareData?.result?.id;
      if (!imageId) throw new Error("Cloudflare upload failed");

      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

      // 3) user info
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const decoded = token ? jwtDecode(token) : null;
      const userId = decoded?._id || decoded?.id || null;
      const username = decoded?.username || decoded?.name || null;

      // 4) tags
      const tagsArray = (tags || "")
        .replace(/#/g, "")
        .split(/[ ,，、]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // 5) payload
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
        likes: 0,
        userId,
        username,
        steps: steps || undefined,
        sampler: sampler || undefined,
        cfgScale: cfgScale || undefined,
        seed: seed || undefined,
        clipSkip: clipSkip || undefined,
        width: width || undefined,
        height: height || undefined,
        modelHash: modelHash || undefined,
      };

      // 6) save metadata
      const metaRes = await fetch("/api/cloudflare-images", {
        method: "POST",
        body: JSON.stringify(metadata),
        headers: { "Content-Type": "application/json" },
      });
      if (!metaRes.ok) throw new Error("Metadata API failed");

      // 7) done
      setStep(1);
      onClose?.();
      location.reload();
    } catch (err) {
      console.error("upload failed", err);
      alert("上傳失敗，請稍後再試！");
      if (imageId) {
        try { await fetch(`/api/delete-cloudflare-image?id=${imageId}`, { method: "DELETE" }); }
        catch (delErr) { console.error("cleanup failed", delErr); }
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* file first */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-300 font-semibold">上傳圖片（先選檔，會自動讀取生成參數）</label>
        <input
          type="file"
          className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          accept="image/*"
          onChange={(e) => { if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]); }}
        />
        {metaStatus === "found" && (
          <div className="text-xs text-emerald-400">✅ 已自動讀取到生成參數（已預填於進階參數）</div>
        )}
        {metaStatus === "none" && (
          <div className="text-xs text-zinc-400">ℹ️ 未偵測到 PNG Info，但不影響上傳。你可於下方「進階參數」手動補充或貼上。</div>
        )}
        {metaStatus === "error" && (
          <div className="text-xs text-red-400">⚠️ 解析 PNG Info 失敗（格式或壓縮導致）。可於「進階參數」手動補充。</div>
        )}
      </div>

      {preview && (
        <div className="rounded-lg overflow-hidden border border-white/10">
          <img src={preview} alt="preview" className="w-full object-contain" />
        </div>
      )}

      {/* rating */}
      <div className="flex items-center gap-4">
        <div className={`text-xl font-bold px-4 py-2 rounded text-white inline-block ${getRatingColor()}`}>
          目前選擇：{rating === "all" ? "一般 All" : rating === "15" ? "15+ 清涼" : "18+ 限制"}
        </div>
        <select className="p-2 rounded bg-zinc-700" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="all">一般（All）</option>
          <option value="15">15+（輕限）</option>
          <option value="18">18+（限制）</option>
        </select>
      </div>

      {/* base fields */}
      <input type="text" placeholder="標題" className="w-full p-2 rounded bg-zinc-700" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="來源作者（選填）" className="w-full p-2 rounded bg-zinc-700" value={author} onChange={(e) => setAuthor(e.target.value)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={`text-sm font-semibold ${category === "" ? "text-red-400" : "text-zinc-400"}`}>📁 圖片分類（必選）</label>
          <select className={`p-2 rounded w-full bg-zinc-700 ${category === "" ? "border border-red-500" : ""}`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled hidden>請選擇分類</option>
            {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
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

      {/* prompts */}
      <textarea placeholder="正面提詞（Prompt）" className="w-full p-2 rounded bg-zinc-700 h-20" value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} />
      <textarea placeholder="負面提詞（Negative Prompt）" className="w-full p-2 rounded bg-zinc-700 h-20" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />

      {/* model / lora & links */}
      <input type="text" placeholder="模型名稱（選填）" className="w-full p-2 rounded bg-zinc-700" value={modelName} onChange={(e) => setModelName(e.target.value)} />
      <input type="text" placeholder="模型 civitai 連結（可選）" className="w-full p-2 rounded bg-zinc-700" value={modelLink} onChange={(e) => setModelLink(e.target.value)} />
      <input type="text" placeholder="LoRA 名稱（選填；可多個以逗號分隔）" className="w-full p-2 rounded bg-zinc-700" value={loraName} onChange={(e) => setLoraName(e.target.value)} />
      <input type="text" placeholder="LoRA civitai 連結（可選）" className="w-full p-2 rounded bg-zinc-700" value={loraLink} onChange={(e) => setLoraLink(e.target.value)} />
      <p className="text-xs text-zinc-400">只接受 <span className="underline">civitai.com</span> 的網址（可留白）。</p>

      {/* tags & description */}
      <input type="text" placeholder="標籤（以空格或逗號分隔，例如：可愛 貓耳 女僕）" className="w-full p-2 rounded bg-zinc-700" value={tags} onChange={(e) => setTags(e.target.value)} />
      <textarea placeholder="描述（選填）" className="w-full p-2 rounded bg-zinc-700 h-28" value={description} onChange={(e) => setDescription(e.target.value)} />

      {/* advanced */}
      <div className="rounded-lg border border-white/10">
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="w-full text-left px-4 py-2 font-semibold bg-zinc-800 hover:bg-zinc-700 transition">
          {showAdvanced ? "▼" : "►"} 進階參數（可選）
        </button>
        {showAdvanced && (
          <div className="p-4 space-y-3 bg-zinc-900/60">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input className="p-2 rounded bg-zinc-700" placeholder="Seed" value={seed} onChange={(e) => setSeed(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="Sampler" value={sampler} onChange={(e) => setSampler(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="Steps" value={steps} onChange={(e) => setSteps(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="CFG Scale" value={cfgScale} onChange={(e) => setCfgScale(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="Clip skip" value={clipSkip} onChange={(e) => setClipSkip(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="寬度 (px)" value={width} onChange={(e) => setWidth(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="高度 (px)" value={height} onChange={(e) => setHeight(e.target.value)} />
              <input className="p-2 rounded bg-zinc-700" placeholder="Model hash" value={modelHash} onChange={(e) => setModelHash(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400">貼上 PNG Info / A1111 參數字串（會嘗試自動解析）</label>
              <textarea className="w-full p-2 rounded bg-zinc-700 h-24" value={pasteInfo} onChange={(e) => setPasteInfo(e.target.value)} placeholder={"例：\nPrompt...\nNegative prompt: ...\nSteps: 30, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 768x1024, Clip skip: 2\n<lora:myLora:0.8>"} />
              <div className="flex gap-2">
                <button type="button" onClick={() => {
                  const parsed = parseA1111Parameters(pasteInfo);
                  if (parsed) { applyParsed(parsed); alert("已解析並填入欄位"); }
                  else { alert("解析失敗，請確認格式。"); }
                }} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">解析並填入</button>
                <button type="button" onClick={() => setPasteInfo("")} className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm">清空</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          {useOriginal ? "使用原檔上傳" : "使用壓縮圖上傳"}
          {originalSize ? `｜原檔 ${(originalSize / 1024 / 1024).toFixed(2)} MB` : ""}
          {compressedSize ? `｜壓縮 ${(compressedSize / 1024 / 1024).toFixed(2)} MB` : ""}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">
            <input type="checkbox" className="mr-1 align-middle" checked={useOriginal} onChange={(e) => setUseOriginal(e.target.checked)} />
            使用原檔
          </label>
          <button disabled={isUploading} onClick={handleUpload} className={`px-4 py-2 rounded text-white ${isUploading ? "bg-zinc-600" : "bg-blue-600 hover:bg-blue-700"} transition`}>
            {isUploading ? "上傳中..." : "上傳"}
          </button>
        </div>
      </div>
    </div>
  );
}

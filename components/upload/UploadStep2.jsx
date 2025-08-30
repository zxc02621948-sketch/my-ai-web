"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import pako from "pako";
import { jwtDecode } from "jwt-decode";
import CATEGORIES from "@/constants/categories";
import { civitaiByHash } from "@/lib/civitai";
import { parseComfyWorkflow } from "@/lib/parseComfyWorkflow";

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
  // ====== Local state ======
  const [author, setAuthor] = useState("");
  const [modelName, setModelName] = useState("");
  const [loraName, setLoraName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  // 使用者是否改動過連結欄位（避免自動覆蓋）
  const [modelLinkTouched, setModelLinkTouched] = useState(false);
  const [loraLinkTouched, setLoraLinkTouched] = useState(false);

  // UI 提示：剛剛已自動帶入
  const [autoFilledModelLink, setAutoFilledModelLink] = useState(false);
  const [autoFilledLoraLink, setAutoFilledLoraLink] = useState(false);

  // advanced
  const [steps, setSteps] = useState("");
  const [sampler, setSampler] = useState("");
  const [cfgScale, setCfgScale] = useState("");
  const [seed, setSeed] = useState("");
  const [clipSkip, setClipSkip] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [modelHash, setModelHash] = useState("");
  const [loraHashes, setLoraHashes] = useState([]);

  // ui
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null); // null | 'found' | 'none' | 'error'
  const [pasteInfo, setPasteInfo] = useState("");
  const [confirmAdult, setConfirmAdult] = useState(false);

  // ComfyUI workflow 相關（新增）
  const [workflowName, setWorkflowName] = useState("");
  const [workflowRaw, setWorkflowRaw] = useState(""); // 原始 workflow JSON
  const [promptRaw, setPromptRaw] = useState(""); // PNG 內 prompt 若是 Comfy JSON
  const [shareWorkflow, setShareWorkflow] = useState(true); // 是否隨作品附檔

  const workflowInputRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // ====== Helpers ======
  const getRatingColor = () => {
    switch (rating) {
      case "all":
        return "bg-green-600";
      case "15":
        return "bg-yellow-500";
      case "18":
        return "bg-red-600";
      default:
        return "bg-zinc-600";
    }
  };

  // 讀取原始檔案實際像素
  async function getImageSizeFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h });
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  // -------- PNG/iTXt/zTXt 解析 --------
  const textDecoder = useMemo(() => new TextDecoder("utf-8"), []);

  async function extractPngTextChunks(file) {
    const ab = await file.arrayBuffer();
    const dv = new DataView(ab);
    // PNG signature
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
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
        const compressionMethod = raw[p++];
        readToNull(); // languageTag
        readToNull(); // translatedKeyword
        let text = "";
        if (compressionFlag === 1 && compressionMethod === 0) {
          try {
            text = textDecoder.decode(pako.inflate(raw.slice(p)));
          } catch {}
        } else {
          text = textDecoder.decode(raw.slice(p));
        }
        if (key) out[key] = text;
      } else if (type === "zTXt") {
        const raw = new Uint8Array(ab, dataStart, length);
        const idx = raw.indexOf(0);
        const key = textDecoder.decode(raw.slice(0, Math.max(0, idx)));
        const method = raw[idx + 1];
        let text = "";
        try {
          if (method === 0) text = textDecoder.decode(pako.inflate(raw.slice(idx + 2)));
        } catch {}
        if (key && text) out[key] = text;
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

    const loraSet = new Set();
    const rx1 = /(?:^|[\s,])(?:Lora|LoRA):\s*([^:,\n<>]+)(?::[^,\n]+)?/gi;
    let mm;
    while ((mm = rx1.exec(parameters)) !== null) {
      const name = mm[1].trim();
      if (name) loraSet.add(name);
    }
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

    // 解析 LoRA hashes
    const loraHashLine = parameters.match(/Lora hashes\s*:\s*([^\n\r]+)/i)?.[1];
    if (loraHashLine) {
      const items = loraHashLine
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const hashes = [];
      for (const it of items) {
        const m = it.match(/([0-9a-f]{8,64})/i);
        if (m) hashes.push(m[1].toLowerCase());
      }
      if (hashes.length) out.loraHashes = Array.from(new Set(hashes));
    }

    if (out.size) {
      const m = out.size.match(/(\d+)x(\d+)/);
      if (m) {
        out.width = m[1];
        out.height = m[2];
      }
    }

    return out;
  }

  function tryParseComfy(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      const out = {};
      if (data && typeof data === "object") {
        const text = JSON.stringify(data);
        const gr = (re) => text.match(re)?.[1] || "";
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
        return out;
      }
      return null;
    } catch {
      return null;
    }
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
    if (Array.isArray(parsed.loraHashes) && parsed.loraHashes.length) setLoraHashes(parsed.loraHashes);
  }

  // 當選檔時：讀 PNG Info + 偵測平台 + 壓縮
  useEffect(() => {
    if (!imageFile) return;
    setOriginalSize(imageFile.size || 0);

    const run = async () => {
      try {
        let parsed = null;
        let detectedPlatform = null;

        if (imageFile.type === "image/png") {
          const chunks = await extractPngTextChunks(imageFile);

          // ✅ 優先判斷 ComfyUI：workflow（最準）
          if (!parsed && (chunks.workflow || chunks.Workflow)) {
            try {
              const wfVal = chunks.workflow || chunks.Workflow;
              const comfy = parseComfyWorkflow(wfVal);
              if (comfy && Array.isArray(comfy.nodes) && comfy.nodes.length > 0) {
                parsed = comfy.canonical;
                detectedPlatform = "ComfyUI";
                const wfStr = typeof wfVal === "string" ? wfVal : JSON.stringify(wfVal, null, 2);
                setWorkflowRaw(wfStr);
              }
            } catch {}
          }

          // ✅ ComfyUI：prompt 內就是 Comfy JSON
          if (!parsed && chunks.prompt) {
            try {
              const maybe = parseComfyWorkflow(chunks.prompt);
              if (maybe && Array.isArray(maybe.nodes) && maybe.nodes.length > 0) {
                parsed = maybe.canonical;
                detectedPlatform = "ComfyUI";
                const prStr = typeof chunks.prompt === "string" ? chunks.prompt : JSON.stringify(chunks.prompt, null, 2);
                setPromptRaw(prStr);
              } else {
                const comfyLite = tryParseComfy(chunks.prompt);
                if (comfyLite) {
                  parsed = comfyLite;
                  detectedPlatform = "ComfyUI";
                  const prStr = typeof chunks.prompt === "string" ? chunks.prompt : JSON.stringify(chunks.prompt, null, 2);
                  setPromptRaw(prStr);
                }
              }
            } catch {
              const comfyLite = tryParseComfy(chunks.prompt);
              if (comfyLite) {
                parsed = comfyLite;
                detectedPlatform = "ComfyUI";
                const prStr = typeof chunks.prompt === "string" ? chunks.prompt : JSON.stringify(chunks.prompt, null, 2);
                setPromptRaw(prStr);
              }
            }
          }

          // ✅ A1111 / SD WebUI
          if (!parsed && chunks.parameters) {
            parsed = parseA1111Parameters(chunks.parameters);
            if (parsed) detectedPlatform = "Stable Diffusion WebUI";
          } else if (!parsed && (chunks["sd-metadata"] || chunks["sd_metadata"] || chunks["SD:metadata"])) {
            try {
              const json = chunks["sd-metadata"] || chunks["sd_metadata"] || chunks["SD:metadata"];
              const meta = JSON.parse(json);
              parsed = {
                prompt: meta.prompt || meta.Prompt || "",
                negative: meta.negative_prompt || meta.NegativePrompt || "",
                steps: meta.steps,
                sampler: meta.sampler,
                cfgScale: meta.cfg_scale ?? meta.cfg,
                seed: meta.seed,
                width: meta.width,
                height: meta.height,
                model: meta.model || meta.Model,
                modelHash: meta.model_hash || meta.ModelHash,
                clipSkip: meta.clip_skip ?? meta.clipSkip,
              };
              if (parsed) detectedPlatform = "Stable Diffusion WebUI";
            } catch {}
          }

          // ✅ 文字啟發式（適配只有 Title/Description 的情況）
          if (
            !detectedPlatform &&
            !chunks.parameters &&
            !chunks["sd-metadata"] &&
            !chunks["sd_metadata"] &&
            !chunks["SD:metadata"]
          ) {
            const allText = Object.entries(chunks)
              .map(([k, v]) => `${String(k)}: ${typeof v === "string" ? v : ""}`)
              .join("\n")
              .toLowerCase();
            if (allText.includes("comfyui")) {
              detectedPlatform = "ComfyUI";
            }
          }

          // ✅ 套用結果
          if (parsed) {
            applyParsed(parsed);
            if (detectedPlatform) setPlatform(detectedPlatform);
            setMetaStatus("found");
            setShowAdvanced(true);
          } else {
            if (detectedPlatform === "ComfyUI") setPlatform("ComfyUI");
            setMetaStatus("none");
          }
        } else {
          // 非 PNG：沒有 metadata 可讀 → 以檔名保底（含 comfyui）
          if (/comfyui/i.test(imageFile.name || "")) {
            setPlatform("ComfyUI");
          }
        }

        // 壓縮
        await compressImage(imageFile);
      } catch (e) {
        console.warn("PNG metadata parse failed", e);
        setMetaStatus("error");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);
  
  // 只要偵測到主模型 hash，就嘗試查 civitai 並自動填入（除非使用者已手動改過）
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!modelHash || modelLinkTouched) return;
      try {
        const ref = await civitaiByHash(modelHash);
        if (!ref || aborted) return;
        const url = ref?.links?.modelLink || "";
        if (url) {
          setModelLink(url);
          setAutoFilledModelLink(true);
        }
      } catch (e) {
        // 靜默失敗即可
      }
    })();
    return () => { aborted = true; };
  }, [modelHash, modelLinkTouched]);

  // 有 LoRA hashes 時，彙整多個 civitai 連結自動填入（除非使用者已手動改過）
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!Array.isArray(loraHashes) || !loraHashes.length || loraLinkTouched) return;
      const uniq = Array.from(new Set(loraHashes)).slice(0, 20);
      const links = [];
      for (const h of uniq) {
        try {
          const ref = await civitaiByHash(h);
          if (aborted) return;
          const link = ref?.links?.modelLink || ref?.links?.versionLink || "";
          if (link) links.push(link);
        } catch {}
      }
      if (!aborted && links.length) {
        setLoraLink(links.join("\n"));
        setAutoFilledLoraLink(true);
      }
    })();
    return () => { aborted = true; };
  }, [loraHashes, loraLinkTouched]);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        try { URL.revokeObjectURL(preview); } catch {}
      }
    };
  }, [preview]);
  
  useEffect(() => {
    if (!compressedImage) return;
    const url = URL.createObjectURL(compressedImage);
    setPreview((old) => {
      if (old && old.startsWith("blob:")) { try { URL.revokeObjectURL(old); } catch {} }
      return url;
    });
    return () => { try { URL.revokeObjectURL(url); } catch {} };
  }, [compressedImage, setPreview]);

  const compressImage = async (originalFile) => {
    const img = new Image();
    img.src = URL.createObjectURL(originalFile);
    img.onload = async () => {
      const originalW = img.naturalWidth || img.width;
      const originalH = img.naturalHeight || img.height;
      setWidth((w) => w || String(originalW));
      setHeight((h) => h || String(originalH));

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

  // ====== ComfyUI workflow 上傳解析 ======
  const handleClickWorkflowUpload = () => {
    workflowInputRef.current?.click();
  };

  const handleWorkflowFile = async (file) => {
    if (!file) return;
    setWorkflowName(file.name || "workflow.json");

    try {
      const text = await file.text();
      setWorkflowRaw(text); // 保存原始 workflow 檔

      let comfyParsed = null;
      try {
        const asObj = JSON.parse(text);
        const result = parseComfyWorkflow(asObj);
        if (result && Array.isArray(result.nodes) && result.nodes.length > 0) {
          comfyParsed = result.canonical;
        }
      } catch {
        comfyParsed = tryParseComfy(text);
      }

      if (!comfyParsed) {
        alert("讀取/解析 ComfyUI workflow 失敗，請確認檔案內容。");
        return;
      }

      setPlatform("ComfyUI");
      applyParsed(comfyParsed);
      setShowAdvanced(true);

      alert("已解析 workflow 並填入參數！");
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("workflow parse error", e);
      alert("解析 workflow 過程中發生錯誤。");
    }
  };

  // ====== Submit ======
  const civitaiRegex = /^https?:\/\/(www\.)?civitai\.com(\/|$)/i;

  const handleUpload = async () => {
    if (!imageFile) {
      alert("請先選擇圖片檔");
      return;
    }
    if (!title || !title.trim()) {
      alert("請輸入圖片標題！");
      return;
    }
    if (!category) {
      alert("請選擇圖片分類！");
      return;
    }
    if (modelLink && !civitaiRegex.test(modelLink)) {
      alert("模型連結僅允許 civitai.com 網址。");
      return;
    }
    if (loraLink) {
      const lines = loraLink.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const invalid = lines.some(line => !civitaiRegex.test(line));
      if (invalid) {
        alert("LoRA 連結僅允許 civitai.com 網址（多筆請每行一條）。");
        return;
      }
    }
    if (rating === "18" && !confirmAdult) {
      alert("請勾選『成年聲明』以確認內容不涉及未成年人。");
      return;
    }

    setIsUploading(true);

    let wNum = Number(width);
    let hNum = Number(height);
    if (!Number.isFinite(wNum) || !Number.isFinite(hNum) || !wNum || !hNum) {
      try {
        const s = await getImageSizeFromFile(imageFile);
        wNum = s.width;
        hNum = s.height;
        setWidth(String(wNum));
        setHeight(String(hNum));
      } catch {}
    }

    let imageId = null;

    try {
      const urlRes = await fetch("/api/cloudflare-upload-url", { method: "POST" });
      if (!urlRes.ok) throw new Error("Cloudflare upload URL API error");
      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.uploadURL) throw new Error("No uploadURL received");

      const formData = new FormData();
      formData.append("file", compressedImage);
      const cloudflareRes = await fetch(urlData.uploadURL, { method: "POST", body: formData });
      const cloudflareData = await cloudflareRes.json();
      imageId = cloudflareData?.result?.id;
      if (!imageId) throw new Error("Cloudflare upload failed");

      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const decoded = token ? jwtDecode(token) : null;
      const userId = decoded?._id || decoded?.id || null;
      const username = decoded?.username || decoded?.name || null;

      const tagsArray = (tags || "")
        .replace(/#/g, "")
        .split(/[ ,，、]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const metadataBase = {
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
        width: Number.isFinite(wNum) && wNum ? wNum : undefined,
        height: Number.isFinite(hNum) && hNum ? hNum : undefined,
        modelHash: modelHash || undefined,
        adultDeclaration: rating === "18" ? true : undefined,
        // ⬇️ 新增：若勾選分享 workflow，夾帶到後端
        comfy: shareWorkflow
          ? {
              workflowRaw: workflowRaw || undefined,
              promptRaw: promptRaw || undefined,
              allowShare: shareWorkflow, 
            }
          : undefined,
      };

      // 以 hash 自動補 Civtai modelLink
      let modelRef = null;
      if (!metadataBase.modelLink && modelHash) {
        try {
          const ref = await civitaiByHash(modelHash);
          if (ref) {
            modelRef = {
              modelId: ref.modelId ?? undefined,
              versionId: ref.versionId ?? undefined,
              modelName: ref.modelName ?? undefined,
              modelType: ref.modelType ?? undefined,
              modelLink: ref.links?.modelLink ?? "",
              versionLink: ref.links?.versionLink ?? "",
            };
            if (!metadataBase.modelName && modelRef.modelName) metadataBase.modelName = modelRef.modelName;
            if (!metadataBase.modelLink && modelRef.modelLink) metadataBase.modelLink = modelRef.modelLink;
          }
        } catch (e) {
          console.warn("civitai main model lookup failed", e);
        }
      }

      let loraRefs = [];
      if (Array.isArray(loraHashes) && loraHashes.length) {
        const uniq = Array.from(new Set(loraHashes)).slice(0, 20);
        for (const h of uniq) {
          try {
            const ref = await civitaiByHash(h);
            if (ref) {
              loraRefs.push({
                hash: h,
                modelId: ref.modelId ?? undefined,
                versionId: ref.versionId ?? undefined,
                name: ref.modelName ?? undefined,
                modelLink: ref.links?.modelLink ?? "",
                versionLink: ref.links?.versionLink ?? "",
              });
            }
          } catch (e) {
            console.warn("civitai lora lookup failed", h, e);
          }
        }
      }

      if (!metadataBase.loraLink && loraRefs.length) {
        const links = loraRefs.map((r) => r.modelLink || r.versionLink).filter(Boolean);
        if (links.length) {
          metadataBase.loraLink = links.join("\n");
        }
      }

      const metadata = {
        ...metadataBase,
        ...(modelRef ? { modelRef } : {}),
        ...(loraRefs.length ? { loraHashes, loraRefs } : {}),
      };

      const metaRes = await fetch("/api/cloudflare-images", {
        method: "POST",
        body: JSON.stringify(metadata),
        headers: { "Content-Type": "application/json" },
      });
      if (!metaRes.ok) throw new Error("Metadata API failed");

      setStep(1);
      onClose?.();
      location.reload();
    } catch (err) {
      console.error("upload failed", err);
      alert("上傳失敗，請稍後再試！");
      if (imageId) {
        try {
          await fetch(`/api/delete-cloudflare-image?id=${imageId}`, { method: "DELETE" });
        } catch (delErr) {
          console.error("cleanup failed", delErr);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ====== UI ======
  return (
    <div
      className="relative flex flex-col bg-[#121212] text-white h-full"
      style={{
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        paddingTop: "max(env(safe-area-inset-top), 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
      }}
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#121212]/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          >
            ← 返回
          </button>
          <div className="text-sm opacity-80">上傳圖片 · 填寫資訊</div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          >
            關閉
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 pb-28 space-y-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* 檔案選擇 / PNG Info */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-300 font-semibold">
            上傳圖片（先選檔，會自動讀取生成參數）
          </label>
          <input
            type="file"
            className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImageFile(f);
              // 建立預覽，並釋放舊的 blob URL
              const url = URL.createObjectURL(f);
              setPreview((old) => {
                if (old && old.startsWith("blob:")) {
                  try { URL.revokeObjectURL(old); } catch {}
                }
                return url;
              });
            }}
          />
          {metaStatus === "found" && (
            <div className="text-xs text-emerald-400">
              ✅ 已自動讀取到生成參數（已預填於進階參數 / 並自動判斷平台）
            </div>
          )}
          {metaStatus === "none" && (
            <div className="text-xs text-zinc-400">
              ℹ️ 未偵測到 PNG Info，但不影響上傳。你可於下方「進階參數」手動補充或貼上。
            </div>
          )}
          {metaStatus === "error" && (
            <div className="text-xs text-red-400">
              ⚠️ 解析 PNG Info 失敗（格式或壓縮導致）。可於「進階參數」手動補充。
            </div>
          )}
        </div>

        {/* 預覽 */}
        {preview && (
          <div className="rounded-lg overflow-hidden border border-white/10">
            <img src={preview} alt="preview" className="w-full max-h-[50vh] object-contain" />
          </div>
        )}

        {/* 分級 */}
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

        {/* 18+ 成年聲明 */}
        {rating === "18" && (
          <div className="space-y-2 border border-red-500/40 rounded-lg p-3 bg-red-900/20">
            <div className="text-sm text-red-300 font-semibold">18+ 成年聲明（必勾）</div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmAdult}
                onChange={(e) => setConfirmAdult(e.target.checked)}
                className="mt-1"
              />
              <span>
                我確認本次上傳內容<strong>僅描繪成年角色</strong>，不包含未成年人或未成年特徵（如兒童/國小國中生情境、兒童制服、兒童配件、身心年幼設定等），
                並已正確標記為 <b>18+</b>。
              </span>
            </label>
            <p className="text-xs text-red-200/80">若被檢舉或查核涉及未成年內容，帳號可能被限制或移除，內容將被刪除且不另行通知。</p>
          </div>
        )}

        {/* 基本欄位 */}
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
            <label className={`text-sm font-semibold ${category === "" ? "text-red-400" : "text-zinc-400"}`}>
              📁 圖片分類（必選）
            </label>
            <select
              className={`p-2 rounded w-full bg-zinc-700 ${category === "" ? "border border-red-500" : ""}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="" disabled hidden>
                請選擇分類
              </option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-zinc-400">🛠️ 使用平台</label>
            <div className="flex items-center gap-2">
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

              {/* ComfyUI：上傳 workflow 按鈕 */}
              {platform === "ComfyUI" && (
                <>
                  <input
                    ref={workflowInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleWorkflowFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleClickWorkflowUpload}
                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm text-white"
                    title="上傳 ComfyUI workflow（.json）並自動解析"
                  >
                    上傳 workflow
                  </button>
                </>
              )}
            </div>

            {/* ComfyUI：是否附檔（移除上傳頁的下載按鈕） */}
            {platform === "ComfyUI" && (
              <div className="mt-2 text-xs text-zinc-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shareWorkflow}
                    onChange={(e) => setShareWorkflow(e.target.checked)}
                  />
                  上傳時將 workflow 附在作品頁可供下載
                </label>
              </div>
            )}

            {platform === "ComfyUI" && workflowName && (
              <div className="mt-1 text-xs text-zinc-400">已選擇：{workflowName}</div>
            )}
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

        {/* 模型 / LoRA 與連結 */}
        <input
          type="text"
          placeholder="模型名稱（選填）"
          className="w-full p-2 rounded bg-zinc-700"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
        />
        <input
          type="text"
          placeholder="模型 civitai 連結（可選）"
          className="w-full p-2 rounded bg-zinc-700"
          value={modelLink}
          onChange={(e) => {
            setModelLink(e.target.value);
            setModelLinkTouched(true); 
          }}
        />
        {autoFilledModelLink && (
            <div className="text-xs text-emerald-400 mt-1">
              已自動偵測並填入 civitai 連結
            </div>
          )}
        <input
          type="text"
          placeholder="LoRA 名稱（選填；可多個以逗號分隔）"
          className="w-full p-2 rounded bg-zinc-700"
          value={loraName}
          onChange={(e) => setLoraName(e.target.value)}
        />
        {autoFilledLoraLink && (
          <div className="text-xs text-emerald-400 mt-1">
            已自動偵測並填入 LoRA civitai 連結
          </div>
        )}
        <textarea
          placeholder="LoRA civitai 連結（可選；多筆請一行一條）"
          className="w-full p-2 rounded bg-zinc-700 h-20 resize-y"
          value={loraLink}
          onChange={(e) => {
            setLoraLink(e.target.value);
            setLoraLinkTouched(true);
          }}
        />

        {/* LoRA hashes（可選） */}
        <input
          type="text"
          placeholder="LoRA hashes（可多個；以空格、逗號或換行分隔）"
          className="w-full p-2 rounded bg-zinc-700"
          value={(loraHashes || []).join(", ")}
          onChange={(e) => {
            const arr = String(e.target.value)
              .split(/[\s,，、]+/)
              .map((s) => s.trim().toLowerCase())
              .filter((s) => /^[0-9a-f]{8,64}$/.test(s));
            setLoraHashes(arr);
          }}
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

        {/* 進階參數 */}
        <div className="rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full text-left px-4 py-2 font-semibold bg-zinc-800 hover:bg-zinc-700 transition"
          >
            {showAdvanced ? "▼" : "►"} 進階參數（可選）
          </button>

          {showAdvanced && (
            <div className="p-4 space-y-3 bg-zinc-900/60">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="Steps"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="Sampler"
                  value={sampler}
                  onChange={(e) => setSampler(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="CFG Scale"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="Seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="Clip skip"
                  value={clipSkip}
                  onChange={(e) => setClipSkip(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="寬度 (px)"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="高度 (px)"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
                <input
                  className="p-2 rounded bg-zinc-700"
                  placeholder="Model hash"
                  value={modelHash}
                  onChange={(e) => setModelHash(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400">貼上 PNG Info / A1111 參數字串（會嘗試自動解析）</label>
                <textarea
                  className="w-full p-2 rounded bg-zinc-700 h-24"
                  value={pasteInfo}
                  onChange={(e) => setPasteInfo(e.target.value)}
                  placeholder={`例：
Prompt...
Negative prompt: ...
Steps: 30, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 768x1024, Clip skip: 2
<lora:myLora:0.8>`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseA1111Parameters(pasteInfo);
                      if (parsed) {
                        applyParsed(parsed);
                        alert("已解析並填入欄位");
                      } else {
                        alert("解析失敗，請確認格式。");
                      }
                      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    解析並填入
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasteInfo("")}
                    className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
                  >
                    清空
                  </button>
                </div>

                {platform === "ComfyUI" && (
                  <div className="text-xs text-zinc-400">
                    小提醒：你也可以直接點「上傳 workflow」匯入 ComfyUI 的 JSON 來自動填入參數。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 尾端留白，避免被底部按鈕遮住 */}
        <div className="h-10 md:h-0" />
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-20 bg-[#121212]/90 backdrop-blur border-t border-white/10">
        <div className="flex items-center justify-end px-4 py-3">
          <div className="flex items-center justify-end px-4 py-3">
            <button
              disabled={isUploading}
              onClick={onUpload ? onUpload : handleUpload}
              className={`px-4 py-2 rounded text-white ${
                isUploading ? "bg-zinc-600" : "bg-blue-600 hover:bg-blue-700"
              } transition`}
            >
              {isUploading ? "上傳中..." : "上傳"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

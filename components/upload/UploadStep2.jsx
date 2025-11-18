"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import pako from "pako";
import { jwtDecode } from "jwt-decode";
import CATEGORIES from "@/constants/categories";
import { civitaiByHash } from "@/lib/civitai";
import { parseComfyWorkflow } from "@/lib/parseComfyWorkflow";
import { notify } from "@/components/common/GlobalNotificationManager";
import SelectField from "@/components/common/SelectField";

const IMAGE_UPLOAD_SUCCESS_STORAGE_KEY = "imageUploadSuccessMessage";

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
  useOriginal,
  setUseOriginal,
  title,
  setTitle,
  platform,
  setPlatform,
  description,
  setDescription,
  category,
  setCategory,
  categories = [],
  setCategories,
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
  uploadLimits,
  mobileSimple = false, // 手機簡化模式
}) {
  // ====== Local state ======
  const [author, setAuthor] = useState("");
  const [modelName, setModelName] = useState("");
  const [loraName, setLoraName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  // 手機簡化模式：設置默認 rating 為 "sfw"
  useEffect(() => {
    if (mobileSimple && !rating) {
      setRating("sfw");
    }
  }, [mobileSimple, rating, setRating]);

  // 使用者是否改動過連結欄位（避免自動覆蓋）
  const [modelLinkTouched, setModelLinkTouched] = useState(false);
  const [loraLinkTouched, setLoraLinkTouched] = useState(false);

  // UI 提示：剛剛已自動帶入
  const [autoFilledModelLink, setAutoFilledModelLink] = useState(false);
  const [autoFilledLoraLink, setAutoFilledLoraLink] = useState(false);
  const [detectedLorasWithoutLinks, setDetectedLorasWithoutLinks] = useState([]);

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
  
  // 字段来源追踪（auto = 自动读取，manual = 手动输入）
  const [stepsSource, setStepsSource] = useState(null);
  const [samplerSource, setSamplerSource] = useState(null);
  const [cfgScaleSource, setCfgScaleSource] = useState(null);
  const [seedSource, setSeedSource] = useState(null);
  const [clipSkipSource, setClipSkipSource] = useState(null);
  const [modelHashSource, setModelHashSource] = useState(null);
  const [widthSource, setWidthSource] = useState(null);
  const [heightSource, setHeightSource] = useState(null);
  
  // 验证错误状态
  const [validationErrors, setValidationErrors] = useState({});

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

  // AI自動分類相關
  const workflowInputRef = useRef(null);
  const scrollAreaRef = useRef(null);

  // ✅ 即時判斷元數據質量（用於更智能的分類）
  const getCurrentMetadataQuality = useMemo(() => {
    // 模擬 getMetadataQuality 的邏輯
    const hasModel = modelName?.trim() && modelName.trim() !== "(未提供)";
    const hasLora = loraName?.trim() && loraName.trim() !== "(未提供)";
    const hasPrompt = positivePrompt?.trim() && positivePrompt.trim() !== "(無)";
    
    // 如果不是AI生成圖，返回普通图
    if (!hasModel && !hasLora && !hasPrompt) return "普通图";
    
    // 檢查各項參數
    const params = [
      { name: 'modelName', value: modelName },
      { name: 'loraName', value: loraName },
      { name: 'positivePrompt', value: positivePrompt },
      { name: 'negativePrompt', value: negativePrompt },
      { name: 'steps', value: steps },
      { name: 'sampler', value: sampler },
      { name: 'cfgScale', value: cfgScale },
      { name: 'seed', value: seed },
      { name: 'width', value: width },
      { name: 'height', value: height }
    ];
    
    let totalCount = 0;
    let autoCount = 0;
    
    params.forEach(param => {
      const value = param.value;
      if (value && typeof value === 'string' && value.trim() && 
          value.trim() !== "(未提供)" && value.trim() !== "(無)") {
        totalCount++;
        autoCount++; // 簡化：假設有值就是自動抓取
      } else if (value && typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        totalCount++;
        autoCount++;
      }
    });
    
    if (totalCount === 0) return "普通图";
    
    const autoRatio = autoCount / totalCount;
    if (autoRatio >= 0.8) return "优质图";
    if (autoRatio >= 0.5) return "标准图";
    return "普通图";
  }, [positivePrompt, negativePrompt, modelName, loraName, sampler, seed, steps, cfgScale, width, height]);

  const willHaveMetadata = useMemo(() => {
    return getCurrentMetadataQuality === "优质图" || getCurrentMetadataQuality === "标准图";
  }, [getCurrentMetadataQuality]);

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
  
  // ====== 验证函数 ======
  const validateField = (fieldName, value, source) => {
    // 如果是自动读取，跳过验证（信任元数据）
    if (source === 'auto') {
      return { valid: true };
    }
    
    // 空值允许（不填不加分而已）
    if (!value || value.trim() === '') {
      return { valid: true };
    }
    
    const val = value.trim();
    
    switch (fieldName) {
      case 'steps': {
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 150) {
          return { valid: false, error: 'Steps 必须是 1-150 之间的整数' };
        }
        return { valid: true };
      }
      
      case 'cfgScale': {
        const num = Number(val);
        if (isNaN(num) || num < 1 || num > 30) {
          return { valid: false, error: 'CFG Scale 必须是 1-30 之间的数字' };
        }
        // 检查小数位数（最多1位）
        if (val.includes('.') && val.split('.')[1]?.length > 1) {
          return { valid: false, error: 'CFG Scale 最多1位小数' };
        }
        return { valid: true };
      }
      
      case 'clipSkip': {
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 12) {
          return { valid: false, error: 'Clip Skip 必须是 1-12 之间的整数' };
        }
        return { valid: true };
      }
      
      case 'seed': {
        const num = Number(val);
        if (!Number.isInteger(num) || (num < -1 || num > 4294967295)) {
          return { valid: false, error: 'Seed 必须是整数（-1 表示随机，最大 4294967295）' };
        }
        return { valid: true };
      }
      
      case 'sampler': {
        // 允许：英文、数字、空格、下划线、加号、减号、括号
        const regex = /^[a-zA-Z0-9\s_+\-()]+$/;
        if (!regex.test(val)) {
          return { valid: false, error: 'Sampler 只能包含英文、数字和常用符号 (_+-())' };
        }
        if (val.length > 50) {
          return { valid: false, error: 'Sampler 名称最多 50 字符' };
        }
        return { valid: true };
      }
      
      case 'modelHash': {
        // 允许：十六进制字符
        const regex = /^[a-fA-F0-9]+$/;
        if (!regex.test(val)) {
          return { valid: false, error: 'Model Hash 必须是十六进制字符（0-9, a-f）' };
        }
        if (val.length < 4 || val.length > 20) {
          return { valid: false, error: 'Model Hash 长度必须是 4-20 位' };
        }
        return { valid: true };
      }
      
      default:
        return { valid: true };
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
    
    // 自动读取的字段标记来源为 'auto'
    if (parsed.steps) {
      setSteps(parsed.steps);
      setStepsSource('auto');
    }
    if (parsed.sampler) {
      setSampler(parsed.sampler);
      setSamplerSource('auto');
    }
    if (parsed.cfgScale) {
      setCfgScale(parsed.cfgScale);
      setCfgScaleSource('auto');
    }
    if (parsed.seed) {
      setSeed(parsed.seed);
      setSeedSource('auto');
    }
    if (parsed.clipSkip) {
      setClipSkip(parsed.clipSkip);
      setClipSkipSource('auto');
    }
    if (parsed.modelHash) {
      setModelHash(parsed.modelHash);
      setModelHashSource('auto');
    }
    
    if (parsed.width) {
      setWidth(parsed.width);
      setWidthSource('auto');
    }
    if (parsed.height) {
      setHeight(parsed.height);
      setHeightSource('auto');
    }
    setModelName(parsed.model || "");
    
    // 只有当有 LoRA hashes（链接）时，才自动填入 LoRA 名称
    if (Array.isArray(parsed.loraHashes) && parsed.loraHashes.length) {
      setLoraHashes(parsed.loraHashes);
      // 如果有 hashes，说明有链接，可以安全填入名称
      if (Array.isArray(parsed.loras) && parsed.loras.length) {
        setLoraName(parsed.loras.join(", "));
      }
    } else if (Array.isArray(parsed.loras) && parsed.loras.length) {
      // 如果只有名称没有链接，不自动填入，让用户手动选择
      console.log("检测到 LoRA 名称但没有链接，不自动填入:", parsed.loras);
      setDetectedLorasWithoutLinks(parsed.loras);
    }
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
            if (detectedPlatform === "ComfyUI") {
              setPlatform("ComfyUI");
            } else {
              // ✅ 沒有檢測到任何平台且無元數據 → 自動設置為「其他」
              setPlatform("其他");
            }
            setMetaStatus("none");
          }
        } else {
          // 非 PNG：沒有 metadata 可讀 → 以檔名保底（含 comfyui）
          if (/comfyui/i.test(imageFile.name || "")) {
            setPlatform("ComfyUI");
          } else {
            // ✅ 非 PNG 且檔名不包含 comfyui → 自動設置為「其他」
            setPlatform("其他");
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
      // 尺寸已在选择文件时读取，这里不再重复设置
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
        notify.error("解析失敗", "讀取/解析 ComfyUI workflow 失敗，請確認檔案內容。");
        return;
      }

      setPlatform("ComfyUI");
      applyParsed(comfyParsed);
      setShowAdvanced(true);

      notify.success("解析成功", "已解析 workflow 並填入參數！");
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("workflow parse error", e);
      notify.error("解析失敗", "解析 workflow 過程中發生錯誤。");
    }
  };

  // ====== Submit ======
  const allowedModelRegex = /^https?:\/\/(www\.)?(civitai\.com|seaart\.ai)(\/|$)/i;

  const handleUpload = async () => {
    if (!imageFile) {
      notify.warning("提示", "請先選擇圖片檔");
      return;
    }
    
    // 验证是否有可上传的文件（原图或压缩图）
    if (!useOriginal && !compressedImage) {
      notify.warning("提示", "圖片正在壓縮中，請稍候...");
      return;
    }
    
    if (!title || !title.trim()) {
      notify.warning("提示", "請輸入圖片標題！");
      return;
    }
    if (!categories || categories.length === 0) {
      notify.warning("提示", "請選擇至少一個分類（最多3個）！");
      return;
    }
    if (categories.length > 3) {
      notify.warning("提示", "最多只能選擇3個分類！");
      return;
    }
    if (modelLink && !allowedModelRegex.test(modelLink)) {
      notify.warning("提示", "模型連結僅允許 civitai.com 或 seaart.ai 網址。");
      return;
    }
    if (loraLink) {
      const lines = loraLink.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const invalid = lines.some(line => !allowedModelRegex.test(line));
      if (invalid) {
        notify.warning("提示", "LoRA 連結僅允許 civitai.com 或 seaart.ai 網址（多筆請每行一條）。");
        return;
      }
    }
    if (rating === "18" && !confirmAdult) {
      notify.warning("提示", "請勾選『成年聲明』以確認內容不涉及未成年人。");
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
      // 获取要上传的文件信息
      const fileToUpload = useOriginal ? imageFile : compressedImage;
      
      // ✅ 直接使用服務器端上傳（v1 API）
      const serverFormData = new FormData();
      serverFormData.append("file", fileToUpload);
      
      const serverRes = await fetch("/api/cloudflare-upload", {
        method: "POST",
        body: serverFormData,
      });
      
      if (!serverRes.ok) {
        const serverError = await serverRes.json();
        throw new Error(serverError.message || "服務器端上傳失敗");
      }
      
      const serverData = await serverRes.json();
      if (!serverData.success || !serverData.imageId) {
        throw new Error("服務器端上傳失敗：未獲取到圖片 ID");
      }
      
      imageId = serverData.imageId;
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

      const normalizedRating =
        rating === "all" ? "sfw" : (rating === "general" ? "sfw" : rating || "sfw");

      // 手機簡化模式：模型名稱以下的欄位為空，確保 hasMetadata = false
      const metadataBase = {
        imageId,
        imageUrl,
        title: title?.trim() || "",
        author: mobileSimple ? "" : (author?.trim() || ""),
        category: categories.length > 0 ? categories[0] : (category || ""), // 保持向後兼容
        categories: categories || [],
        rating: normalizedRating,
        platform: platform?.trim() || "",
        modelName: mobileSimple ? "" : (modelName?.trim() || ""),
        loraName: mobileSimple ? "" : (loraName?.trim() || ""),
        modelLink: mobileSimple ? "" : (modelLink?.trim() || ""),
        loraLink: mobileSimple ? "" : (loraLink?.trim() || ""),
        positivePrompt: mobileSimple ? "" : (positivePrompt || ""),
        negativePrompt: mobileSimple ? "" : (negativePrompt || ""),
        description: description || "",
        tags: tagsArray,
        fileName: imageFile.name,
        likes: 0,
        userId,
        username,
        steps: mobileSimple ? undefined : (steps || undefined),
        sampler: mobileSimple ? "" : (sampler || undefined),
        cfgScale: mobileSimple ? undefined : (cfgScale || undefined),
        seed: mobileSimple ? "" : (seed || undefined),
        clipSkip: mobileSimple ? undefined : (clipSkip || undefined),
        width: mobileSimple ? undefined : (Number.isFinite(wNum) && wNum ? wNum : undefined),
        height: mobileSimple ? undefined : (Number.isFinite(hNum) && hNum ? hNum : undefined),
        modelHash: mobileSimple ? "" : (modelHash || undefined),
        adultDeclaration: normalizedRating === "18" ? true : undefined,
        // ⬇️ 新增：若勾選分享 workflow，夾帶到後端（手機簡化模式不分享）
        comfy: mobileSimple ? undefined : (shareWorkflow
          ? {
              workflowRaw: workflowRaw || undefined,
              promptRaw: promptRaw || undefined,
              allowShare: shareWorkflow, 
            }
          : undefined),
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

      // ✅ 上傳成功提示（根據元數據質量顯示結果）
      const finalQuality = getCurrentMetadataQuality;
      
      let successBody;
      if (finalQuality === "优质图") {
        successBody = "⭐ 此圖片已標記為「優質圖」\n✨ 將出現在「作品展示」和「創作參考」中\n🎓 其他用戶可以學習您的高質量生成參數";
      } else if (finalQuality === "标准图") {
        successBody = "✓ 此圖片已標記為「標準圖」\n✨ 將出現在「作品展示」和「創作參考」中\n📚 其他用戶可以參考您的生成參數";
      } else {
        successBody = "🎨 此圖片已標記為「展示圖」\n📸 將出現在「作品展示」中供欣賞\n💡 建議填寫有意義的參數以進入「創作參考」";
      }

      let storedMessage = false;
      try {
        const payload = {
          title: "✅ 上傳成功！",
          body: successBody,
          quality: finalQuality,
        };
        sessionStorage.setItem(IMAGE_UPLOAD_SUCCESS_STORAGE_KEY, JSON.stringify(payload));
        storedMessage = true;
      } catch (error) {
        console.warn("儲存圖片上傳成功提示失敗:", error);
      }

      if (!storedMessage) {
        notify.success("上傳成功", successBody);
      }

      setStep(1);
      onClose?.();
      location.reload();
    } catch (err) {
      console.error("upload failed", err);
      notify.error("上傳失敗", "請稍後再試！");
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
          <div className="text-center flex-1">
            <div className="text-sm opacity-80">上傳圖片 · 填寫資訊</div>
            {uploadLimits && (
              <div className="text-xs text-zinc-400 mt-1">
                今日上傳：{uploadLimits.todayUploads}/{uploadLimits.dailyLimit} 張
                {uploadLimits.isLimitReached && (
                  <span className="text-red-400 ml-1">（已達上限）</span>
                )}
              </div>
            )}
          </div>
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
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              
              // 验证文件类型
              const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
              if (!validTypes.includes(f.type.toLowerCase())) {
                notify.warning("文件格式不支持", "只支持 PNG、JPG、JPEG、WebP 格式的图片！");
                e.target.value = ''; // 清空选择
                return;
              }
              
              // 验证文件大小（最大 20MB）
              const maxSize = 20 * 1024 * 1024; // 20MB
              if (f.size > maxSize) {
                notify.warning("文件太大", `最大支持 20MB，当前文件: ${(f.size / 1024 / 1024).toFixed(2)}MB`);
                e.target.value = ''; // 清空选择
                return;
              }
              
              setImageFile(f);
              setOriginalSize(f.size);
              
              // 立即读取真实尺寸（优先于压缩）
              try {
                const dimensions = await getImageSizeFromFile(f);
                setWidth(String(dimensions.width));
                setHeight(String(dimensions.height));
                setWidthSource('auto');
                setHeightSource('auto');
              } catch (error) {
                console.warn('读取图片尺寸失败:', error);
              }
              
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
          {!mobileSimple && metaStatus === "found" && (
            <div className="text-xs text-emerald-400">
              ✅ 已自動讀取到生成參數（已預填於進階參數 / 並自動判斷平台）
            </div>
          )}
          {!mobileSimple && metaStatus === "none" && (
            <div className="text-xs text-zinc-400">
              ℹ️ 未偵測到 PNG Info，但不影響上傳。你可於下方「進階參數」手動補充或貼上。
            </div>
          )}
          {!mobileSimple && metaStatus === "error" && (
            <div className="text-xs text-red-400">
              ⚠️ 解析 PNG Info 失敗（格式或壓縮導致）。可於「進階參數」手動補充。
            </div>
          )}
        </div>

        {/* 預覽 */}
        {preview && (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden border border-white/10">
              <img src={preview} alt="preview" className="w-full max-h-[50vh] object-contain" />
            </div>
            
            {/* 文件信息和压缩选项 */}
            {imageFile && (
              <div className="text-xs text-zinc-400 space-y-2">
                <div className="flex items-center justify-between">
                  <span>原始文件: {(imageFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  {compressedImage && !useOriginal && (
                    <span className="text-emerald-400">
                      压缩后: {(compressedImage.size / 1024 / 1024).toFixed(2)} MB 
                      (节省 {(((imageFile.size - compressedImage.size) / imageFile.size) * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
                
                {/* 使用原图选项 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOriginal}
                    onChange={(e) => setUseOriginal(e.target.checked)}
                    className="rounded"
                  />
                  <span>上传原图（不压缩，文件会更大但质量更高）</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* 分級 - 直式排列 */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3">
            <div className={`text-xl font-bold px-4 py-2 rounded text-white inline-block ${getRatingColor()} self-start`}>
              目前選擇：{rating === "all" ? "一般 All" : rating === "15" ? "15+ 清涼" : "18+ 限制"}
            </div>
            <SelectField
              value={rating}
              onChange={setRating}
              options={[
                { value: "all", label: "一般（All）" },
                { value: "15", label: "15+（輕限）" },
                { value: "18", label: "18+（限制）" },
              ]}
              placeholder="選擇分級"
              buttonClassName="bg-zinc-700 text-white"
            />
          </div>

          {/* 移除自動分級功能 - 改為用戶手動選擇 */}
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
        {/* 來源作者 - 手機簡化模式隱藏 */}
        {!mobileSimple && (
          <input
            type="text"
            placeholder="來源作者（選填）"
            className="w-full p-2 rounded bg-zinc-700"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm font-semibold ${categories.length === 0 ? "text-red-400" : "text-zinc-400"}`}>
              📁 圖片分類（可複選，最多3個）
            </label>
          <div
            className={`max-h-32 overflow-y-auto rounded p-2 bg-zinc-700 ${
              categories.length === 0 ? "border border-red-500" : categories.length >= 3 ? "border border-yellow-500/50" : "border border-white/10"
            }`}
          >
            {CATEGORIES.map((categoryKey) => {
              const isSelected = categories.includes(categoryKey);
              const isDisabled = !isSelected && categories.length >= 3;
              
              return (
                <label
                  key={categoryKey}
                  className={`flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-600/50 rounded px-2 ${
                    isDisabled ? "opacity-50 cursor-not-allowed" : ""
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
            
            {/* 移除自動分級功能 - 改為用戶手動選擇 */}
          </div>

          <div>
            <label className="text-sm text-zinc-400">🛠️ 使用平台</label>
            <div className="flex items-center gap-2">
            <SelectField
              value={platform}
              onChange={setPlatform}
              options={[
                { value: "Stable Diffusion WebUI", label: "Stable Diffusion WebUI" },
                { value: "ComfyUI", label: "ComfyUI" },
                { value: "SeaArt.ai", label: "SeaArt.ai" },
                { value: "其他", label: "其他" },
              ]}
              placeholder="選擇平台"
              className="flex-1"
              buttonClassName="bg-zinc-700 text-white"
            />

              {/* ComfyUI：上傳 workflow 按鈕 - 手機簡化模式隱藏 */}
              {!mobileSimple && platform === "ComfyUI" && (
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

            {/* ComfyUI：是否附檔（移除上傳頁的下載按鈕） - 手機簡化模式隱藏 */}
            {!mobileSimple && platform === "ComfyUI" && (
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

            {!mobileSimple && platform === "ComfyUI" && workflowName && (
              <div className="mt-1 text-xs text-zinc-400">已選擇：{workflowName}</div>
            )}
          </div>
        </div>

        {/* 提詞 - 手機簡化模式隱藏 */}
        {!mobileSimple && (
          <>
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
            {detectedLorasWithoutLinks.length > 0 && (
              <div className="text-xs text-yellow-400 mt-1">
                ⚠️ 检测到 LoRA 名称但无链接：{detectedLorasWithoutLinks.join(", ")}<br/>
                如需填入，请手动复制粘贴到上方字段
              </div>
            )}
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
              只接受 <span className="underline">civitai.com</span> 或 <span className="underline">seaart.ai</span> 的網址（可留白）。
            </p>
          </>
        )}

        {/* 進階參數 - 手機簡化模式隱藏 */}
        {!mobileSimple && (
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
                {/* Steps */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.steps 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : steps && stepsSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="Steps"
                    value={steps}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSteps(val);
                      // 用户修改 → 强制改为 manual（即使之前是 auto）
                      setStepsSource('manual');
                      
                      // 使用 manual 进行验证
                      const validation = validateField('steps', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        steps: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.steps && (
                    <p className="text-xs text-red-400">{validationErrors.steps}</p>
                  )}
                  {steps && !validationErrors.steps && stepsSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
                
                {/* Sampler */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.sampler 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : sampler && samplerSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="Sampler"
                    value={sampler}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSampler(val);
                      setSamplerSource('manual');
                      
                      const validation = validateField('sampler', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        sampler: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.sampler && (
                    <p className="text-xs text-red-400">{validationErrors.sampler}</p>
                  )}
                  {sampler && !validationErrors.sampler && samplerSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
                
                {/* CFG Scale */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.cfgScale 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : cfgScale && cfgScaleSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="CFG Scale"
                    value={cfgScale}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCfgScale(val);
                      setCfgScaleSource('manual');
                      
                      const validation = validateField('cfgScale', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        cfgScale: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.cfgScale && (
                    <p className="text-xs text-red-400">{validationErrors.cfgScale}</p>
                  )}
                  {cfgScale && !validationErrors.cfgScale && cfgScaleSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
                
                {/* Seed */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.seed 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : seed && seedSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="Seed"
                    value={seed}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSeed(val);
                      setSeedSource('manual');
                      
                      const validation = validateField('seed', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        seed: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.seed && (
                    <p className="text-xs text-red-400">{validationErrors.seed}</p>
                  )}
                  {seed && !validationErrors.seed && seedSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
                
                {/* Clip Skip */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.clipSkip 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : clipSkip && clipSkipSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="Clip skip"
                    value={clipSkip}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClipSkip(val);
                      setClipSkipSource('manual');
                      
                      const validation = validateField('clipSkip', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        clipSkip: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.clipSkip && (
                    <p className="text-xs text-red-400">{validationErrors.clipSkip}</p>
                  )}
                  {clipSkip && !validationErrors.clipSkip && clipSkipSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
                {/* 尺寸自动读取，只读显示 */}
                <div className="p-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center gap-2">
                  <span className="text-xs">宽度:</span>
                  <span className="text-white font-mono">{width || '自动读取中...'}</span>
                  <span className="text-xs">px</span>
                  {widthSource === 'auto' && <span className="text-xs text-emerald-400">✓ 自动读取</span>}
                </div>
                <div className="p-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center gap-2">
                  <span className="text-xs">高度:</span>
                  <span className="text-white font-mono">{height || '自动读取中...'}</span>
                  <span className="text-xs">px</span>
                  {heightSource === 'auto' && <span className="text-xs text-emerald-400">✓ 自动读取</span>}
                </div>
                {/* Model Hash */}
                <div className="space-y-1">
                  <input
                    className={`p-2 rounded w-full ${
                      validationErrors.modelHash 
                        ? 'bg-red-900/30 border-2 border-red-500' 
                        : modelHash && modelHashSource !== 'auto'
                        ? 'bg-emerald-900/30 border-2 border-emerald-500'
                        : 'bg-zinc-700'
                    }`}
                    placeholder="Model hash"
                    value={modelHash}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModelHash(val);
                      setModelHashSource('manual');
                      
                      const validation = validateField('modelHash', val, 'manual');
                      setValidationErrors(prev => ({
                        ...prev,
                        modelHash: validation.valid ? null : validation.error
                      }));
                    }}
                  />
                  {validationErrors.modelHash && (
                    <p className="text-xs text-red-400">{validationErrors.modelHash}</p>
                  )}
                  {modelHash && !validationErrors.modelHash && modelHashSource === 'auto' && (
                    <p className="text-xs text-emerald-400">✓ 自动读取</p>
                  )}
                </div>
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
                        notify.success("成功", "已解析並填入欄位");
                      } else {
                        notify.error("解析失敗", "請確認格式。");
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
        )}

        {/* 尾端留白，避免被底部按鈕遮住 */}
        <div className="h-10 md:h-0" />
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-20 bg-[#121212]/90 backdrop-blur border-t border-white/10">
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* ✅ 即時預覽：根據元數據質量智能分類 */}
          {getCurrentMetadataQuality === "优质图" ? (
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-2.5 mb-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-yellow-400 font-semibold">⭐ 優質圖</span>
                <span className="text-gray-300 text-xs">
                  高質量元數據，將出現在「作品展示」和「創作參考」中，其他用戶可學習
                </span>
              </div>
            </div>
          ) : getCurrentMetadataQuality === "标准图" ? (
            <div className="bg-green-900/30 border border-green-500 rounded-lg p-2.5 mb-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-semibold">✓ 標準圖</span>
                <span className="text-gray-300 text-xs">
                  標準元數據，將出現在「作品展示」和「創作參考」中
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-600 rounded-lg p-2.5 mb-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 font-semibold">🎨 展示圖</span>
                <span className="text-gray-300 text-xs">
                  無有效元數據，僅出現在「作品展示」
                  <span className="block mt-0.5 text-yellow-300">
                    💡 建議填寫有意義的 Prompt 或模型資訊以進入「創作參考」
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {Object.keys(validationErrors).filter(k => validationErrors[k]).length > 0 && (
            <div className="text-sm text-red-400 text-right">
              ⚠️ 请修正红框标记的错误字段
            </div>
          )}
          
          {/* 按钮区域 */}
          <div className="flex items-center justify-end">
            <button
              disabled={isUploading || Object.keys(validationErrors).some(k => validationErrors[k])}
              onClick={onUpload ? onUpload : handleUpload}
              className={`px-4 py-2 rounded text-white transition ${
                isUploading || Object.keys(validationErrors).some(k => validationErrors[k])
                  ? "bg-zinc-600 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isUploading ? "上傳中..." : "上傳"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

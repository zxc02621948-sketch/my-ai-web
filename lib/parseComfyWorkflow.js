/**
 * ComfyUI workflow 解析器（初版）
 * 目標：
 *  - 從 workflow JSON 解析出 canonical 欄位（model、sampler、steps、cfg、seed、width、height、LoRA）
 *  - 同時回傳 nodes 清單（重要節點摘要），與 raw（完整 JSON 字串）
 *
 * 使用方式：
 *   import { parseComfyWorkflow } from "@/lib/parseComfyWorkflow";
 *   const { canonical, nodes, raw } = parseComfyWorkflow(workflowJsonOrObject);
 *
 * 注意：
 *  - ComfyUI 節點型別很多、插件各異，此版只涵蓋最常見的：Checkpoint/LoRA/KSampler/EmptyLatentImage
 *  - 取不到的值會是 undefined；你前端可以只顯示有值的欄位
 */

function safeJsonStringify(obj) {
  try {
    return typeof obj === "string" ? obj : JSON.stringify(obj);
  } catch {
    return "";
  }
}

function toObject(workflow) {
  if (!workflow) return null;
  if (typeof workflow === "string") {
    try { return JSON.parse(workflow); } catch { return null; }
  }
  if (typeof workflow === "object") return workflow;
  return null;
}

/** 兼容不同導出格式：有的在 { "nodes": [...] }，有的直接是 { "0": {...}, "1": {...} } */
function normalizeNodes(wfObj) {
  if (!wfObj) return [];
  if (Array.isArray(wfObj.nodes)) return wfObj.nodes;
  // 有些版本是以 id -> node 的 object
  const values = Object.values(wfObj);
  // 粗略判斷是否像 node 物件
  const looksLikeNode = (n) =>
    n && (n.type || n.class_type || n._meta) && (n.inputs || n.widgets_values || n.properties);
  if (values.length && values.every(looksLikeNode)) return values;
  return [];
}

function lower(s) { return String(s || "").toLowerCase(); }

/** 從節點嘗試取欄位（不同版本鍵名不一致，這裡做彈性找尋） */
function pickField(node, candidates = []) {
  for (const key of candidates) {
    // 支援 path 形式 e.g. "inputs.seed"
    if (key.includes(".")) {
      const parts = key.split(".");
      let cur = node;
      let ok = true;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else { ok = false; break; }
      }
      if (ok && cur !== undefined && cur !== null) return cur;
    } else if (node && key in node) {
      return node[key];
    }
  }
  return undefined;
}

/** 從 widgets_values（常見於 ComfyUI）推測某些值 */
function fromWidgets(node, idxOrPredicate) {
  const w = node?.widgets_values;
  if (!Array.isArray(w)) return undefined;
  if (typeof idxOrPredicate === "number") return w[idxOrPredicate];
  if (typeof idxOrPredicate === "function") {
    return w.find(idxOrPredicate);
  }
  return undefined;
}

/** 嘗試辨識節點類型字串 */
function nodeType(node) {
  return lower(node?.type || node?.class_type || node?._meta?.class_type);
}

/** 嘗試抓取 KSampler 類型（採樣器/步數/CFG/Seed） */
function extractSamplerFields(node) {
  // 常見 class_type: "KSampler", "KSamplerAdvanced" 等
  const t = nodeType(node);
  if (!t.includes("ksampler")) return null;

  // ✅ 優先從 inputs 提取（最準確）
  // ComfyUI KSampler 常見字段：
  // - seed: inputs.seed 或 inputs.noise_seed
  // - steps: inputs.steps
  // - cfg: inputs.cfg 或 inputs.cfg_scale 或 inputs.guidance
  // - sampler_name: inputs.sampler_name 或 inputs.sampler
  const seed =
    pickField(node, ["inputs.seed", "inputs.noise_seed", "properties.seed", "properties.noise_seed"]);
  
  const steps =
    pickField(node, ["inputs.steps", "properties.steps"]);
  
  // ✅ CFG 有多種命名：cfg, cfg_scale, guidance
  const cfg =
    pickField(node, ["inputs.cfg", "inputs.cfg_scale", "inputs.guidance", "properties.cfg", "properties.cfg_scale"]);
  
  const sampler =
    pickField(node, ["inputs.sampler_name", "inputs.sampler", "properties.sampler_name", "properties.sampler"]);

  // ✅ 如果從 inputs 找不到，嘗試從 widgets_values 提取
  // ComfyUI KSampler widgets_values 順序通常是：[seed, steps, cfg_scale, sampler_name, scheduler, denoise]
  // 但不同版本可能不同，所以我們需要更智能的提取
  let stepsFromWidgets, cfgFromWidgets, seedFromWidgets, samplerFromWidgets;
  
  const widgets = node?.widgets_values;
  if (Array.isArray(widgets)) {
    // ✅ 嘗試按位置提取（標準 KSampler 順序）
    // 但要注意：有些節點可能順序不同，所以我們也檢查類型
    if (widgets.length >= 1 && typeof widgets[0] === "number") {
      seedFromWidgets = widgets[0]; // 第一個數字通常是 seed
    }
    if (widgets.length >= 2 && typeof widgets[2] === "number") {
      stepsFromWidgets = widgets[2]; // 第三個數字通常是 steps（第二個可能是其他參數）
    }
    if (widgets.length >= 3 && typeof widgets[3] === "number") {
      cfgFromWidgets = widgets[3]; // 第四個數字通常是 cfg_scale
    }
    if (widgets.length >= 4 && typeof widgets[4] === "string") {
      samplerFromWidgets = widgets[4]; // 第五個字符串通常是 sampler_name
    }
    
    // ✅ 備用方案：如果按位置找不到，嘗試按類型查找（但要注意順序）
    // 找第一個合理的 steps 值（通常在 1-200 之間）
    if (!stepsFromWidgets) {
      const stepsCandidate = widgets.find(v => typeof v === "number" && v >= 1 && v <= 200);
      if (stepsCandidate && stepsCandidate !== seedFromWidgets) {
        stepsFromWidgets = stepsCandidate;
      }
    }
    
    // ✅ 找第一個合理的 cfg 值（通常在 1-30 之間）
    if (!cfgFromWidgets) {
      const cfgCandidate = widgets.find(v => typeof v === "number" && v >= 1 && v <= 30 && v !== seedFromWidgets && v !== stepsFromWidgets);
      if (cfgCandidate) {
        cfgFromWidgets = cfgCandidate;
      }
    }
    
    // ✅ 找第一個合理的 seed 值（通常是很大的數字，或 -1）
    if (!seedFromWidgets) {
      const seedCandidate = widgets.find(v => typeof v === "number" && (v === -1 || v > 1000));
      if (seedCandidate) {
        seedFromWidgets = seedCandidate;
      }
    }
    
    // ✅ 找 sampler_name（通常是字符串，且不是 prompt）
    if (!samplerFromWidgets) {
      samplerFromWidgets = widgets.find(v => 
        typeof v === "string" && 
        v.length > 0 && 
        v.length < 50 && // 合理的 sampler 名稱長度
        !v.includes("\n") && // 不是 prompt
        !v.includes(" ") || v.split(" ").length <= 3 // 不是長句子
      );
    }
  }

  return {
    type: "KSampler",
    steps: steps !== undefined ? Number(steps) : (stepsFromWidgets !== undefined ? Number(stepsFromWidgets) : undefined),
    cfg: cfg !== undefined ? Number(cfg) : (cfgFromWidgets !== undefined ? Number(cfgFromWidgets) : undefined),
    seed: seed !== undefined ? Number(seed) : (seedFromWidgets !== undefined ? Number(seedFromWidgets) : undefined),
    sampler: sampler ? String(sampler) : (samplerFromWidgets ? String(samplerFromWidgets) : undefined),
  };
}

/** 嘗試抓取 Checkpoint/Model 名稱和哈希 */
function extractCheckpoint(node) {
  // 常見類型：CheckpointLoaderSimple, CheckpointLoader
  const t = nodeType(node);
  if (!t.includes("checkpoint")) return null;

  const modelName =
    pickField(node, ["inputs.ckpt_name", "inputs.model", "properties.ckpt_name"]) ??
    fromWidgets(node, 0); // 很多 loader 的 widgets_values[0] 是名稱
  
  // ✅ 嘗試提取模型哈希（雖然 ComfyUI workflow 通常不包含，但某些插件或自定義格式可能有）
  const modelHash =
    pickField(node, [
      "inputs.model_hash",
      "inputs.hash",
      "properties.model_hash",
      "properties.hash",
      "metadata.model_hash",
      "metadata.hash",
    ]) ?? null;

  return {
    name: modelName ? String(modelName) : null,
    hash: modelHash ? String(modelHash) : null,
  };
}

/** 嘗試抓取 LoRA（名稱＋權重） */
function extractLora(node) {
  // 常見類型：LoraLoader、LoraLoaderModelOnly、LoraLoaderAdvanced…名稱不一，找關鍵字 lora
  const t = nodeType(node);
  if (!t.includes("lora")) return null;

  // 名稱常出現在 inputs.lora_name 或 widgets_values[0]
  const name =
    pickField(node, ["inputs.lora_name", "inputs.lora", "properties.lora_name"]) ??
    fromWidgets(node, 0);

  // 權重常見於 inputs.strength_model / inputs.strength_clip 或 widgets_values 中的數字
  const strengthModel =
    pickField(node, ["inputs.strength_model", "inputs.strength", "properties.strength_model"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  const strengthClip =
    pickField(node, ["inputs.strength_clip", "properties.strength_clip"]);

  if (!name) return null;
  return {
    name: String(name),
    weight: strengthModel !== undefined ? Number(strengthModel) : undefined,
    clipWeight: strengthClip !== undefined ? Number(strengthClip) : undefined,
  };
}

/** 嘗試抓解析度：EmptyLatentImage / EmptyLatentImageLike 之類 */
function extractResolution(node) {
  const t = nodeType(node);
  if (!t.includes("latentimage")) return null;

  const width =
    pickField(node, ["inputs.width", "properties.width"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  const height =
    pickField(node, ["inputs.height", "properties.height"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  if (width || height) {
    return { width: width ? Number(width) : undefined, height: height ? Number(height) : undefined };
  }
  return null;
}

/** 嘗試抓取 CLIPTextEncode 節點中的提示詞 */
function extractPrompt(node) {
  // 常見類型：CLIPTextEncode, CLIPTextEncodeSDXL, CLIPTextEncodeAdvanced 等
  const t = nodeType(node);
  if (!t.includes("cliptextencode")) return null;

  // 提示詞通常在 inputs.text 或 widgets_values 中
  const text =
    pickField(node, ["inputs.text", "properties.text", "inputs.prompt", "properties.prompt"]) ??
    fromWidgets(node, (v) => typeof v === "string" && v.length > 0);
  
  if (!text || typeof text !== "string") return null;
  
  // 嘗試判斷是正面還是負面提示詞
  // 通常可以通過節點標題、標籤或連接關係判斷，但這裡簡化處理
  // 如果節點標題或標籤包含 "negative" 或 "neg"，則視為負面提示詞
  const label = lower(node?._meta?.title || node?.name || node?.label || "");
  const isNegative = label.includes("negative") || label.includes("neg");
  
  return {
    text: String(text).trim(),
    isNegative: isNegative,
  };
}

/** 將一整份 workflow 解析為 canonical + nodes + raw */
export function parseComfyWorkflow(workflow) {
  const wfObj = toObject(workflow);
  const nodes = normalizeNodes(wfObj);
  const out = {
    canonical: {
      modelName: undefined,
      modelHash: undefined, // ✅ 模型哈希（通常為 undefined，因為 ComfyUI workflow 不包含）
      sampler: undefined,
      steps: undefined,
      cfg: undefined,
      seed: undefined,
      width: undefined,
      height: undefined,
      // 僅收可顯示的陣列
      loras: [], // { name, weight, clipWeight? }
      // prompt（Comfy 通常拆在多個節點，初版不強求組合）
      positive: undefined,
      negative: undefined,
    },
    nodes: [],  // 節點摘要，用於前端「展開更多」顯示
    raw: safeJsonStringify(wfObj),
  };

  if (!nodes.length) return out;

  const found = {
    checkpoint: undefined,
    checkpointHash: undefined, // ✅ 模型哈希
    sampler: undefined,
    steps: undefined,
    cfg: undefined,
    seed: undefined,
    width: undefined,
    height: undefined,
    loras: [],
    positivePrompts: [], // ✅ 正面提示詞（可能有多個）
    negativePrompts: [], // ✅ 負面提示詞（可能有多個）
  };

  for (const n of nodes) {
    const t = nodeType(n);

    // 摘要蒐集（便於前端列出插件節點）
    out.nodes.push({
      id: n?.id ?? n?._meta?.id,
      type: n?.type || n?.class_type,
      label: n?._meta?.title || n?.name || n?.label,
      inputs: n?.inputs,
      // 僅示意：不要塞太多避免 response 過大
    });

    // 1) 模型
    if (!found.checkpoint) {
      const ckpt = extractCheckpoint(n);
      if (ckpt) {
        found.checkpoint = ckpt.name;
        if (ckpt.hash) found.checkpointHash = ckpt.hash;
      }
    }

    // 2) LoRA
    const l = extractLora(n);
    if (l?.name) {
      found.loras.push(l);
    }

    // 3) 解析度
    if (!found.width || !found.height) {
      const res = extractResolution(n);
      if (res) {
        if (res.width) found.width = res.width;
        if (res.height) found.height = res.height;
      }
    }

    // 4) 採樣器/步數/CFG/Seed
    const ks = extractSamplerFields(n);
    if (ks) {
      // 若有多個 KSampler，通常取「最後一個」或覆寫（此處簡單覆寫）
      if (ks.sampler) found.sampler = ks.sampler;
      if (ks.steps !== undefined) found.steps = ks.steps;
      if (ks.cfg !== undefined) found.cfg = ks.cfg;
      if (ks.seed !== undefined) found.seed = ks.seed;
    }

    // 5) 提示詞（CLIPTextEncode 節點）
    const prompt = extractPrompt(n);
    if (prompt && prompt.text) {
      if (prompt.isNegative) {
        found.negativePrompts.push(prompt.text);
      } else {
        found.positivePrompts.push(prompt.text);
      }
    }
  }

  // 去重 LoRA（以名稱去重）
  if (found.loras.length) {
    const uniq = [];
    const seen = new Set();
    for (const x of found.loras) {
      const key = x.name.trim().toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); uniq.push(x); }
    }
    found.loras = uniq;
  }

  // 填 canonical
  out.canonical.modelName = found.checkpoint;
  out.canonical.modelHash = found.checkpointHash; // ✅ 模型哈希（通常為 undefined）
  out.canonical.sampler = found.sampler;
  out.canonical.steps = found.steps;
  out.canonical.cfg = found.cfg;
  out.canonical.seed = found.seed;
  out.canonical.width = found.width;
  out.canonical.height = found.height;
  out.canonical.loras = found.loras;
  
  // ✅ 合併提示詞（多個 CLIPTextEncode 節點可能有多個提示詞，用換行符連接）
  if (found.positivePrompts.length > 0) {
    out.canonical.positive = found.positivePrompts.join("\n");
  }
  if (found.negativePrompts.length > 0) {
    out.canonical.negative = found.negativePrompts.join("\n");
  }

  return out;
}

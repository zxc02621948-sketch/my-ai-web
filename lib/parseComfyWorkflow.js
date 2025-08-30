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

  // 來源優先序：inputs > properties > widgets_values
  const steps =
    pickField(node, ["inputs.steps", "properties.steps"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  const cfg =
    pickField(node, ["inputs.cfg", "properties.cfg"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  const seed =
    pickField(node, ["inputs.seed", "properties.seed"]) ??
    Number(fromWidgets(node, (v) => typeof v === "number"));
  const sampler =
    pickField(node, ["inputs.sampler_name", "inputs.sampler", "properties.sampler_name"]) ??
    fromWidgets(node, (v) => typeof v === "string");

  return {
    type: "KSampler",
    steps: steps !== undefined ? Number(steps) : undefined,
    cfg: cfg !== undefined ? Number(cfg) : undefined,
    seed: seed !== undefined ? Number(seed) : undefined,
    sampler: sampler ? String(sampler) : undefined,
  };
}

/** 嘗試抓取 Checkpoint/Model 名稱 */
function extractCheckpoint(node) {
  // 常見類型：CheckpointLoaderSimple, CheckpointLoader
  const t = nodeType(node);
  if (!t.includes("checkpoint")) return null;

  const modelName =
    pickField(node, ["inputs.ckpt_name", "inputs.model", "properties.ckpt_name"]) ??
    fromWidgets(node, 0); // 很多 loader 的 widgets_values[0] 是名稱
  return modelName ? String(modelName) : null;
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

/** 將一整份 workflow 解析為 canonical + nodes + raw */
export function parseComfyWorkflow(workflow) {
  const wfObj = toObject(workflow);
  const nodes = normalizeNodes(wfObj);
  const out = {
    canonical: {
      modelName: undefined,
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
    sampler: undefined,
    steps: undefined,
    cfg: undefined,
    seed: undefined,
    width: undefined,
    height: undefined,
    loras: [],
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
      if (ckpt) found.checkpoint = ckpt;
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
  out.canonical.sampler = found.sampler;
  out.canonical.steps = found.steps;
  out.canonical.cfg = found.cfg;
  out.canonical.seed = found.seed;
  out.canonical.width = found.width;
  out.canonical.height = found.height;
  out.canonical.loras = found.loras;

  return out;
}

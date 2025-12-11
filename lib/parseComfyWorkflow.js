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

/** 嘗試抓取任何節點中的提示詞（增強版：支持更多節點類型和字段位置） */
function extractPrompt(node) {
  const t = nodeType(node);
  
  // ✅ 排除明顯不是提示詞節點的類型（優先檢查，避免浪費時間）
  const excludedTypes = ["saveimage", "loadimage", "previewimage", "emptyimage", "image", "vae", "model", "checkpoint", "lora", "sampler", "scheduler", "empty", "latent"];
  if (excludedTypes.some(excluded => t.includes(excluded))) {
    return null;
  }
  
  // ✅ 排除 SaveImage 節點的 filename_prefix 字段
  if (t.includes("saveimage")) {
    return null;
  }
  
  // ✅ 擴展：支持更多節點類型
  // 不僅僅是 CLIPTextEncode，還包括其他可能包含提示詞的節點
  const isTextEncodeNode = t.includes("cliptextencode") || 
                           t.includes("textencode") ||
                           t.includes("prompt") ||
                           (t.includes("text") && !t.includes("save") && !t.includes("load"));
  
  // ✅ 如果節點類型不匹配，但節點標題/標籤暗示是提示詞節點，也嘗試提取
  const label = lower(node?._meta?.title || node?.name || node?.label || "");
  const looksLikePromptNode = label.includes("prompt") || 
                              (label.includes("text") && !label.includes("save") && !label.includes("load")) ||
                              label.includes("encode") ||
                              label.includes("positive") ||
                              label.includes("negative");
  
  // 如果既不是文本編碼節點，也不像提示詞節點，跳過
  if (!isTextEncodeNode && !looksLikePromptNode) {
    return null;
  }

  // ✅ 輔助函數：判斷字符串是否為模型文件名或其他非提示詞內容
  const isNotPromptText = (str) => {
    if (!str || typeof str !== "string") return true;
    const s = str.trim();
    if (s.length === 0) return true;
    
    const sLower = s.toLowerCase();
    
    // ✅ 1. 檢查文件擴展名（模型文件）
    if (sLower.includes(".safetensors") || 
        sLower.includes(".ckpt") || 
        sLower.includes(".pt") ||
        sLower.includes(".pth") ||
        sLower.endsWith(".safetensors") ||
        sLower.endsWith(".ckpt") ||
        sLower.endsWith(".pt") ||
        sLower.endsWith(".pth")) {
      return true;
    }
    
    // ✅ 2. 檢查是否為模型文件名模式（即使沒有擴展名）
    // 模型文件名通常：大寫字母開頭、包含下劃線、可能包含版本號
    const modelNamePattern = /^[A-Z][A-Za-z0-9_]+(v\d+)?(_\w+)?$/;
    if (modelNamePattern.test(s) && s.length < 100) {
      return true;
    }
    
    // ✅ 3. 檢查是否為 sampler 名稱
    const samplerNames = ["euler", "dpm", "ddim", "ddpm", "lms", "plms", "dpm++", "uni_pc", "heun", "ancestral"];
    if (samplerNames.some(name => sLower === name || sLower.includes(name + " "))) {
      return true;
    }
    
    // ✅ 4. 檢查是否為哈希值
    if (/^[a-f0-9]{8,64}$/i.test(s)) {
      return true;
    }
    
    // ✅ 5. 檢查是否為節點類型名稱（如 "CONDITIONING"）
    const nodeTypeNames = ["conditioning", "latent", "image", "model", "vae", "clip", "controlnet", "lora"];
    if (nodeTypeNames.some(name => sLower === name || sLower === name.toUpperCase())) {
      return true;
    }
    
    // ✅ 6. 檢查是否為單一單詞且看起來像技術術語或文件名
    if (s.split(/\s+/).length === 1 && s.length < 50) {
      // 如果只有一個單詞且很短，可能是技術術語而非提示詞
      const techTerms = ["conditioning", "latent", "image", "model", "vae", "clip", "controlnet", "lora", "sampler", "scheduler"];
      if (techTerms.some(term => sLower === term)) {
        return true;
      }
      // ✅ 檢查是否為文件名模式（包含下劃線，且沒有空格）
      // 例如：zimage_turbo_redcraft, flux_redcraft 等
      if (s.includes("_") && !s.includes(" ") && s.length < 50) {
        return true;
      }
      // ✅ 檢查是否為單詞組合（多個單詞用下劃線連接，且沒有空格）
      // 例如：redcraft_redzimage_updated 等
      if (/^[a-z0-9_]+$/i.test(s) && s.split("_").length >= 2 && s.length < 100) {
        return true;
      }
    }
    
    // ✅ 7. 檢查是否包含明顯的模型文件路徑模式
    if (s.includes("\\") || s.includes("/") || s.includes("models/") || s.includes("checkpoints/")) {
      return true;
    }
    
    // ✅ 8. 檢查是否為工作流說明文檔（新增）
    // 包含說明性關鍵詞
    const docKeywords = [
      "工作流說明", "工作流说明", "workflow", "流程", "步驟", "步骤", "step",
      "這是第一步", "這是第二步", "這是第", "流程：", "流程:", "步驟：", "步骤:",
      "加載模型", "加载模型", "設定圖像", "设定图像", "輸入正面", "输入正面",
      "輸入負面", "输入负面", "生成並保存", "生成并保存", "保存的圖像", "保存的图像",
      "⚠️", "重要：", "重要:", "說明：", "说明:", "說明文檔", "说明文档"
    ];
    if (docKeywords.some(keyword => s.includes(keyword))) {
      return true;
    }
    
    // ✅ 9. 檢查是否包含列表格式（如 "1. 加載模型"、"2. 設定圖像"）
    // 匹配：數字 + 點/括號 + 空格 + 中文/英文
    const listPattern = /^\d+[\.\)]\s+[^\n]{1,50}(\n\d+[\.\)]\s+[^\n]{1,50}){2,}/;
    if (listPattern.test(s)) {
      return true;
    }
    
    // ✅ 10. 檢查是否包含過多的中文說明性文字（而非提示詞）
    // 提示詞通常以英文為主，或簡短的中文描述
    // 如果包含大量中文說明性文字，可能是工作流說明
    const chineseCount = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalLength = s.length;
    // 如果中文字符超過總長度的 40%，且包含說明性關鍵詞，可能是說明文檔
    if (chineseCount > totalLength * 0.4 && totalLength > 200) {
      const hasDocStructure = docKeywords.some(keyword => s.includes(keyword)) ||
                             /^\d+[\.\)]\s/.test(s) ||
                             s.includes("：") || s.includes(":");
      if (hasDocStructure) {
        return true;
      }
    }
    
    // ✅ 11. 檢查是否為過長的單一文本塊（工作流說明通常很長）
    // 提示詞通常不會超過 2000 字符，而工作流說明可能更長
    if (s.length > 2000) {
      // 如果超過 2000 字符且包含說明性結構，很可能是說明文檔
      if (docKeywords.some(keyword => s.includes(keyword)) || /^\d+[\.\)]\s/.test(s)) {
        return true;
      }
    }
    
    return false;
  };

  // ✅ 擴展：從更多位置提取提示詞
  // 1. 優先從 inputs 提取（最常見）
  // ✅ 重要：先檢查是否有明確的 negative 字段，這是最準確的判斷方式
  let text = pickField(node, [
    "inputs.negative",  // ✅ 優先檢查 negative 字段
    "properties.negative"
  ]);
  let isNegativeFromField = !!text; // 記錄是否從 negative 字段提取
  
  // 如果沒有 negative 字段，再檢查其他字段
  if (!text) {
    text = pickField(node, [
      "inputs.text", 
      "inputs.prompt", 
      "inputs.positive",
      "inputs.prompt_text",
      "inputs.text_input",
      "properties.text", 
      "properties.prompt",
      "properties.positive"
    ]);
  }
  
  // 過濾掉模型文件名等非提示詞內容
  if (text && isNotPromptText(text)) {
    text = null;
    isNegativeFromField = false;
  }
  
  // 2. 如果 inputs 沒有，嘗試從 widgets_values 提取
  if (!text) {
    const widgets = node?.widgets_values;
    if (Array.isArray(widgets)) {
      // 查找第一個長字符串（通常是提示詞）
      for (const w of widgets) {
        if (typeof w === "string" && w.length > 10) {
          // 使用更嚴格的過濾
          if (!isNotPromptText(w)) {
            text = w;
            break;
          }
        }
      }
    }
  }
  
  // 3. 如果還是沒有，嘗試從整個節點中搜索可能的文本字段
  if (!text && node) {
    // 遞歸搜索節點對象中的字符串字段
    const searchForText = (obj, depth = 0) => {
      if (depth > 3) return null; // 限制遞歸深度
      if (typeof obj === "string" && obj.length > 10) {
        // 使用更嚴格的過濾
        if (!isNotPromptText(obj)) {
          return obj;
        }
      }
      if (typeof obj === "object" && obj !== null) {
        for (const key in obj) {
          // ✅ 跳過明顯是模型相關的字段和文件名相關的字段
          if (key === "id" || 
              key === "class_type" || 
              key === "type" ||
              key === "ckpt_name" ||
              key === "model" ||
              key === "model_name" ||
              key === "lora_name" ||
              key === "sampler_name" ||
              key === "scheduler" ||
              key === "filename_prefix" ||
              key === "filename" ||
              key === "prefix") {
            continue;
          }
          const result = searchForText(obj[key], depth + 1);
          if (result) return result;
        }
      }
      return null;
    };
    text = searchForText(node);
  }
  
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return null;
  }
  
  // ✅ 增強：更智能地判斷是正面還是負面提示詞
  // 優先級：1. 明確的 negative 字段 > 2. 提示詞內容分析 > 3. 節點標籤/類型 > 4. 連接關係推測
  let isNegative = false;
  
  // ✅ 1. 最準確：如果從 negative 字段提取，一定是負面
  if (isNegativeFromField) {
    isNegative = true;
  }
  // ✅ 2. 基於提示詞內容判斷（新增：最可靠的方法）
  // 負面提示詞通常包含特定的關鍵詞
  else if (text) {
    const textLower = text.toLowerCase();
    const negativeKeywords = [
      "bad anatomy", "bad hands", "bad proportions", "bad quality", "blurry",
      "deformed", "disfigured", "extra limbs", "fused fingers", "long neck",
      "malformed", "missing fingers", "mutation", "mutated", "poor quality",
      "text", "watermark", "worst quality", "low quality", "jpeg artifacts",
      "nsfw", "nude", "naked", "explicit", "sexual", "porn",
      "ugly", "duplicate", "error", "out of frame", "extra digit",
      "fewer digits", "cropped", "worst quality", "low quality", "normal quality",
      "bad anatomy", "bad proportions", "extra limbs", "cloned face",
      "disfigured", "gross proportions", "malformed limbs", "missing arms",
      "missing legs", "extra arms", "extra legs", "mutated hands",
      "poorly drawn hands", "poorly drawn face", "mutation", "mutated",
      "extra limbs", "ugly", "bad anatomy", "bad proportions", "deformed",
      "disfigured", "gross proportions", "malformed limbs", "missing arms",
      "missing legs", "extra arms", "extra legs", "mutated hands",
      "fused fingers", "too many fingers", "long neck", "bad anatomy",
      "bad hands", "bad proportions", "bad quality", "blurry", "deformed",
      "disfigured", "extra limbs", "fused body", "heavy armor", "robotic parts",
      "wrong perspective", "childish body", "chibi", "cartoon", "messy background",
      "animal hybrid", "bird head on human", "exaggerated muscles", "cleavage",
      "broken hands", "simplified shading"
    ];
    
    // 檢查是否包含負面關鍵詞
    const hasNegativeKeywords = negativeKeywords.some(keyword => 
      textLower.includes(keyword.toLowerCase())
    );
    
    // 如果包含多個負面關鍵詞，很可能是負面提示詞
    const negativeKeywordCount = negativeKeywords.filter(keyword => 
      textLower.includes(keyword.toLowerCase())
    ).length;
    
    if (negativeKeywordCount >= 2) {
      isNegative = true;
    } else if (hasNegativeKeywords && textLower.length > 50) {
      // 如果包含負面關鍵詞且文本較長，可能是負面提示詞
      isNegative = true;
    }
  }
  // ✅ 3. 檢查節點標籤和類型（優先檢查正面，避免誤判）
  // ✅ 優先檢查正面標籤（如果標籤明確是正面，不應該被判斷為負面）
  const isPositiveByLabel = label.includes("positive") || 
                            label.includes("pos") ||
                            label.includes("正面") ||
                            label.includes("正面提示") ||
                            label.includes("正面提示詞") ||
                            label.includes("正面提示词") ||
                            label.includes("提示词编码") ||
                            label.includes("提示詞編碼") ||
                            (label.includes("提示") && !label.includes("負面") && !label.includes("负面"));
  
  // ✅ 如果標籤明確是正面，且內容判斷不是負面，則確定為正面
  if (isPositiveByLabel && !isNegativeFromField) {
    // 如果標籤是正面，且不是從 negative 字段提取，則確定為正面
    isNegative = false;
  } else if (!isPositiveByLabel && (
    label.includes("negative") || 
    label.includes("neg") ||
    label.includes("bad") ||
    label.includes("unwanted") ||
    label.includes("負面") ||
    label.includes("负面") ||
    t.includes("negative") ||
    t.includes("Negative")
  )) {
    // 只有在標籤不是正面的情況下，才檢查負面標籤
    isNegative = true;
  }
  // ✅ 4. 檢查節點的輸出連接（如果連接到 negative conditioning，可能是負面）
  if (!isNegative && node?.outputs && Array.isArray(node.outputs)) {
    // 檢查輸出是否包含 "negative" 相關的連接
    const hasNegativeOutput = node.outputs.some(output => {
      const outputStr = String(output || "").toLowerCase();
      return outputStr.includes("negative") || outputStr.includes("neg");
    });
    if (hasNegativeOutput) {
      isNegative = true;
    }
  }
  // ✅ 5. 檢查節點的輸入連接（如果從 negative 相關節點輸入，可能是負面）
  if (!isNegative && node?.inputs && typeof node.inputs === "object") {
    const inputsStr = JSON.stringify(node.inputs).toLowerCase();
    if (inputsStr.includes("negative") || inputsStr.includes("neg")) {
      isNegative = true;
    }
  }
  
  
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

  // ✅ 關鍵改進：建立節點連接映射（最準確的判斷方法）
  // links 格式：[sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type]
  const links = wfObj?.links || [];
  const nodeIdToNode = new Map();
  // ✅ 改進：如果節點沒有 id，使用數組索引作為備用 ID（用於簡化的工作流 JSON）
  nodes.forEach((n, index) => {
    let nodeId = n?.id ?? n?._meta?.id;
    // ✅ 如果沒有 id，嘗試從 _meta 的其他字段獲取，或使用索引
    if (nodeId === undefined) {
      // 某些簡化的工作流 JSON 可能將 ID 存儲在其他位置
      nodeId = n?._meta?.nodeId ?? n?._meta?.uuid ?? index;
    }
    if (nodeId !== undefined) nodeIdToNode.set(nodeId, n);
  });

  // ✅ 找出所有 KSampler 節點及其輸入索引
  const kSamplerNodes = new Map(); // nodeId -> { positiveInputIndex, negativeInputIndex }
  nodes.forEach((n, index) => {
    const t = nodeType(n);
    if (t.includes("ksampler")) {
      let nodeId = n?.id ?? n?._meta?.id;
      // ✅ 如果沒有 id，使用備用方案
      if (nodeId === undefined) {
        nodeId = n?._meta?.nodeId ?? n?._meta?.uuid ?? index;
      }
      if (nodeId !== undefined) {
        // 檢查 KSampler 的輸入定義，找出 positive 和 negative 的索引
        // 標準 KSampler 輸入順序：model, seed, steps, cfg, sampler_name, scheduler, positive, negative, latent_image, denoise
        // 但實際可能不同，我們通過 links 來判斷
        kSamplerNodes.set(nodeId, { positiveInputIndex: null, negativeInputIndex: null });
      }
    }
  });
  
  // ✅ 如果 links 為空，嘗試從其他位置獲取（某些簡化的工作流 JSON 可能將 links 存儲在其他位置）
  if (links.length === 0) {
    const altLinks = wfObj?.extra?.links || wfObj?.connections || wfObj?.edges || [];
    // 將備用 links 添加到主 links 數組（但需要確保格式一致）
    // 這裡暫時不處理，因為格式可能不同
  }

  // ✅ 分析 links，找出哪些節點連接到 KSampler 的 positive/negative
  const promptNodeConnection = new Map(); // nodeId -> "positive" | "negative" | null
  
  // ✅ 首先，為每個 KSampler 建立輸入映射（通過檢查 inputs 數組的 localized_name）
  const kSamplerInputMap = new Map(); // nodeId -> { positiveIndex, negativeIndex }
  kSamplerNodes.forEach((_, kSamplerId) => {
    const kSamplerNode = nodeIdToNode.get(kSamplerId);
    if (kSamplerNode && Array.isArray(kSamplerNode.inputs)) {
      let positiveIndex = null;
      let negativeIndex = null;
      kSamplerNode.inputs.forEach((input, idx) => {
        if (input && typeof input === "object") {
          const inputName = lower(input.localized_name || input.name || "");
          if (inputName.includes("positive") || inputName.includes("pos")) {
            positiveIndex = idx;
          } else if (inputName.includes("negative") || inputName.includes("neg")) {
            negativeIndex = idx;
          }
        }
      });
      kSamplerInputMap.set(kSamplerId, { positiveIndex, negativeIndex });
    }
  });
  
  // ✅ 改進：先收集所有連接到 KSampler 的提示詞節點，然後統一判斷
  const promptConnections = []; // [{ sourceNodeId, targetNodeId, targetInputIndex, sourceNode, sourceLabel }]
  
  links.forEach(link => {
    if (!Array.isArray(link) || link.length < 4) return;
    
    // ✅ 注意：ComfyUI links 格式可能是：
    // 格式1：[linkId, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type] (新版本)
    // 格式2：[sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type] (舊版本)
    // 格式3：[sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] (最簡單)
    
    let sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex;
    
    if (link.length >= 6) {
      // 格式1：有 linkId 和 type
      // [linkId, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type]
      [, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else if (link.length === 5) {
      // 格式2：沒有 linkId，但有 type
      // [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex, type]
      [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else if (link.length === 4) {
      // 格式3：最簡單格式
      // [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex]
      [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else {
      return; // 格式不正確，跳過
    }
    
    // 檢查目標是否是 KSampler
    if (kSamplerNodes.has(targetNodeId)) {
      const sourceNode = nodeIdToNode.get(sourceNodeId);
      if (!sourceNode) {
        return;
      }
      
      const sourceType = nodeType(sourceNode);
      // 只處理 CLIPTextEncode 類型的節點
      if (sourceType.includes("cliptextencode") || 
          sourceType.includes("textencode") ||
          sourceType.includes("prompt")) {
        const sourceLabel = lower(sourceNode?._meta?.title || sourceNode?.name || sourceNode?.label || "");
        promptConnections.push({
          sourceNodeId,
          targetNodeId,
          targetInputIndex,
          sourceNode,
          sourceLabel
        });
      }
    }
  });
  
  // ✅ 對每個 KSampler，統一判斷其連接的提示詞節點
  kSamplerNodes.forEach((_, kSamplerId) => {
    const connections = promptConnections.filter(c => c.targetNodeId === kSamplerId);
    if (connections.length === 0) return;
    
    const inputMap = kSamplerInputMap.get(kSamplerId);
    const kSamplerNode = nodeIdToNode.get(kSamplerId);
    
    // ✅ 改進：先按輸入索引排序，確保判斷順序一致
    connections.sort((a, b) => a.targetInputIndex - b.targetInputIndex);
    
    connections.forEach(conn => {
      // ✅ 方法1：通過 KSampler 的輸入映射判斷（最準確）
      if (inputMap) {
        if (inputMap.positiveIndex !== null && conn.targetInputIndex === inputMap.positiveIndex) {
          promptNodeConnection.set(conn.sourceNodeId, "positive");
          return;
        }
        if (inputMap.negativeIndex !== null && conn.targetInputIndex === inputMap.negativeIndex) {
          promptNodeConnection.set(conn.sourceNodeId, "negative");
          return;
        }
      }
      
      // ✅ 方法2：檢查節點標題和類型（次準確，但非常可靠）
      // 負面提示詞的關鍵詞（更全面）
      const negativeKeywords = [
        "negative", "neg", "負面", "负面", "bad", "unwanted", "不要",
        "negative prompt", "負面提示", "负面提示", "負面提示詞", "负面提示词"
      ];
      const isNegativeByLabel = negativeKeywords.some(keyword => conn.sourceLabel.includes(keyword));
      
      // 正面提示詞的關鍵詞（更全面）
      const positiveKeywords = [
        "positive", "pos", "正面", "正面提示", "正面提示詞", "正面提示词",
        "提示词编码", "提示詞編碼", "prompt encode", "text encode"
      ];
      const isPositiveByLabel = positiveKeywords.some(keyword => conn.sourceLabel.includes(keyword));
      
      if (isNegativeByLabel) {
        promptNodeConnection.set(conn.sourceNodeId, "negative");
        return;
      } else if (isPositiveByLabel) {
        promptNodeConnection.set(conn.sourceNodeId, "positive");
        return;
      }
      
      // ✅ 方法3：通過輸入索引和相對位置判斷（備用方案）
      if (!promptNodeConnection.has(conn.sourceNodeId)) {
        // 找出所有連接到同一個 KSampler 的其他提示詞節點
        const otherConnections = connections.filter(c => c.sourceNodeId !== conn.sourceNodeId);
        
        // 如果已經有其他節點被標記，根據相對位置判斷
        const hasNegativeBefore = otherConnections.some(c => 
          promptNodeConnection.get(c.sourceNodeId) === "negative" && c.targetInputIndex < conn.targetInputIndex
        );
        const hasPositiveBefore = otherConnections.some(c => 
          promptNodeConnection.get(c.sourceNodeId) === "positive" && c.targetInputIndex < conn.targetInputIndex
        );
        
        if (hasNegativeBefore) {
          // 如果已經有 negative 在更前面的位置，這個可能是 positive（但這不太可能，因為 positive 通常在 negative 之前）
          promptNodeConnection.set(conn.sourceNodeId, "positive");
        } else if (hasPositiveBefore) {
          // 如果已經有 positive 在更前面的位置，這個可能是 negative
          promptNodeConnection.set(conn.sourceNodeId, "negative");
        } else {
          // 根據標準順序判斷
          // 標準 KSampler 輸入順序：model(0), positive(1), negative(2), latent_image(3), ...
          // 但實際可能不同，我們需要更智能的判斷
          
          // ✅ 改進：檢查 KSampler 節點的實際輸入定義
          if (kSamplerNode && Array.isArray(kSamplerNode.inputs)) {
            const targetInput = kSamplerNode.inputs[conn.targetInputIndex];
            if (targetInput && typeof targetInput === "object") {
              const inputName = lower(targetInput.localized_name || targetInput.name || "");
              if (inputName.includes("positive") || inputName.includes("pos")) {
                promptNodeConnection.set(conn.sourceNodeId, "positive");
                return;
              } else if (inputName.includes("negative") || inputName.includes("neg")) {
                promptNodeConnection.set(conn.sourceNodeId, "negative");
                return;
              }
            }
          }
          
          // ✅ 最後備用方案：根據標準順序推測
          if (conn.targetInputIndex === 1) {
            // 標準順序中 positive 通常是索引 1
            promptNodeConnection.set(conn.sourceNodeId, "positive");
          } else if (conn.targetInputIndex === 2) {
            // 標準順序中 negative 通常是索引 2
            promptNodeConnection.set(conn.sourceNodeId, "negative");
          } else if (conn.targetInputIndex < 3) {
            // 如果索引 < 3，且沒有其他節點，可能是 positive（因為 positive 在 negative 之前）
            // 但如果已經有其他節點在更小的索引，需要比較
            const smallerIndexConnections = otherConnections.filter(c => c.targetInputIndex < conn.targetInputIndex);
            if (smallerIndexConnections.length === 0) {
              promptNodeConnection.set(conn.sourceNodeId, "positive");
            }
          }
        }
      }
    });
  });
  

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

    // 5) 提示詞（增強版：支持所有節點類型）
    // ✅ 關鍵改進：優先使用連接關係判斷（最準確）
    let nodeId = n?.id ?? n?._meta?.id;
    // ✅ 如果沒有 id，使用備用方案（用於簡化的工作流 JSON）
    if (nodeId === undefined) {
      const nodeIndex = nodes.indexOf(n);
      nodeId = n?._meta?.nodeId ?? n?._meta?.uuid ?? nodeIndex;
    }
    
    const connectionType = promptNodeConnection.get(nodeId); // "positive" | "negative" | null
    
    // ✅ 優先：使用專門的 extractPrompt 函數（已增強，支持更多節點類型）
    const prompt = extractPrompt(n);
    if (prompt && prompt.text) {
      // ✅ 優先使用連接關係判斷（最準確）
      // 如果連接關係明確，直接使用連接關係，忽略內容判斷
      if (connectionType === "negative") {
        found.negativePrompts.push(prompt.text);
      } else if (connectionType === "positive") {
        found.positivePrompts.push(prompt.text);
      } else {
        // 如果沒有連接關係，使用原有的判斷邏輯（但這應該很少發生）
        if (prompt.isNegative) {
          found.negativePrompts.push(prompt.text);
        } else {
          found.positivePrompts.push(prompt.text);
        }
      }
    } else {
      // ✅ 備用方案：如果 extractPrompt 沒找到，嘗試直接從節點中搜索
      // 某些自定義節點可能將提示詞存儲在非標準位置
      // ✅ 重要：優先檢查 negative 字段
      let directText = pickField(n, [
        "inputs.negative",  // ✅ 優先檢查 negative 字段
        "properties.negative"
      ]);
      let isNegativeFromDirectField = !!directText;
      
      // 如果沒有 negative 字段，再檢查其他字段
      if (!directText) {
        directText = pickField(n, [
          "inputs.text",
          "inputs.prompt", 
          "inputs.positive",
          "widgets_values.0", // 某些節點的第一個 widget 是提示詞
          "widgets_values.1",
        ]);
      }
      
      // ✅ 排除 SaveImage 等節點的 filename_prefix 和其他非提示詞字段
      const nodeTypeForExclusion = lower(n?.type || n?.class_type || "");
      if (nodeTypeForExclusion.includes("saveimage") || 
          nodeTypeForExclusion.includes("loadimage") ||
          nodeTypeForExclusion.includes("previewimage") ||
          nodeTypeForExclusion.includes("emptyimage")) {
        // 這些節點不應該被提取為提示詞
        directText = null;
        isNegativeFromDirectField = false;
      }
      
      // ✅ 如果 directText 是 filename_prefix 相關的字段，也排除
      if (directText && typeof directText === "string") {
        const directTextLower = lower(directText);
        // 檢查是否為文件名模式（包含下劃線，且沒有空格，且長度較短）
        if ((directTextLower.includes("_") && !directTextLower.includes(" ") && directTextLower.length < 50) ||
            (/^[a-z0-9_]+$/i.test(directText) && directText.split("_").length >= 2 && directText.length < 100)) {
          directText = null;
          isNegativeFromDirectField = false;
        }
      } else if (directText && typeof directText !== "string") {
        // 如果 directText 不是字符串，轉換為字符串或跳過
        if (typeof directText === "object" || Array.isArray(directText)) {
          directText = null;
          isNegativeFromDirectField = false;
        } else {
          directText = String(directText);
        }
      }
      
      if (directText && typeof directText === "string" && directText.trim().length > 10) {
        // ✅ 使用統一的過濾函數（與 extractPrompt 中的邏輯一致）
        const isNotPromptTextLocal = (str) => {
          if (!str || typeof str !== "string") return true;
          const s = str.trim();
          if (s.length === 0) return true;
          const sLower = s.toLowerCase();
          
          // 檢查文件擴展名
          if (sLower.includes(".safetensors") || sLower.includes(".ckpt") || 
              sLower.includes(".pt") || sLower.includes(".pth") ||
              sLower.endsWith(".safetensors") || sLower.endsWith(".ckpt")) {
            return true;
          }
          
          // 檢查模型文件名模式
          const modelNamePattern = /^[A-Z][A-Za-z0-9_]+(v\d+)?(_\w+)?$/;
          if (modelNamePattern.test(s) && s.length < 100) {
            return true;
          }
          
          // 檢查節點類型名稱
          const nodeTypeNames = ["conditioning", "latent", "image", "model", "vae", "clip"];
          if (nodeTypeNames.some(name => sLower === name || sLower === name.toUpperCase())) {
            return true;
          }
          
          // ✅ 檢查工作流說明關鍵詞
          const docKeywords = [
            "工作流說明", "工作流说明", "workflow", "流程", "步驟", "步骤", "step",
            "這是第一步", "這是第二步", "這是第", "流程：", "流程:", "步驟：", "步骤:",
            "加載模型", "加载模型", "設定圖像", "设定图像", "輸入正面", "输入正面",
            "輸入負面", "输入负面", "生成並保存", "生成并保存", "保存的圖像", "保存的图像",
            "⚠️", "重要：", "重要:", "說明：", "说明:", "說明文檔", "说明文档"
          ];
          if (docKeywords.some(keyword => s.includes(keyword))) {
            return true;
          }
          
          // ✅ 檢查列表格式
          const listPattern = /^\d+[\.\)]\s+[^\n]{1,50}(\n\d+[\.\)]\s+[^\n]{1,50}){2,}/;
          if (listPattern.test(s)) {
            return true;
          }
          
          // ✅ 檢查過長文本（可能是說明文檔）
          if (s.length > 2000) {
            if (docKeywords.some(keyword => s.includes(keyword)) || /^\d+[\.\)]\s/.test(s)) {
              return true;
            }
          }
          
          return false;
        };
        
        if (!isNotPromptTextLocal(directText)) {
          // ✅ 使用與 extractPrompt 相同的判斷邏輯
          const label = lower(n?._meta?.title || n?.name || n?.label || "");
          const t = lower(n?.type || n?.class_type || "");
          
          let isNegative = false;
          
          // ✅ 1. 最準確：如果從 negative 字段提取，一定是負面
          if (isNegativeFromDirectField) {
            isNegative = true;
          }
          // ✅ 2. 基於提示詞內容判斷（新增：最可靠的方法）
          else if (directText) {
            const textLower = directText.toLowerCase();
            const negativeKeywords = [
              "bad anatomy", "bad hands", "bad proportions", "bad quality", "blurry",
              "deformed", "disfigured", "extra limbs", "fused fingers", "long neck",
              "malformed", "missing fingers", "mutation", "mutated", "poor quality",
              "text", "watermark", "worst quality", "low quality", "jpeg artifacts",
              "nsfw", "nude", "naked", "explicit", "sexual", "porn",
              "ugly", "duplicate", "error", "out of frame", "extra digit",
              "fewer digits", "cropped", "worst quality", "low quality", "normal quality",
              "bad anatomy", "bad proportions", "extra limbs", "cloned face",
              "disfigured", "gross proportions", "malformed limbs", "missing arms",
              "missing legs", "extra arms", "extra legs", "mutated hands",
              "poorly drawn hands", "poorly drawn face", "mutation", "mutated",
              "extra limbs", "ugly", "bad anatomy", "bad proportions", "deformed",
              "disfigured", "gross proportions", "malformed limbs", "missing arms",
              "missing legs", "extra arms", "extra legs", "mutated hands",
              "fused fingers", "too many fingers", "long neck", "bad anatomy",
              "bad hands", "bad proportions", "bad quality", "blurry", "deformed",
              "disfigured", "extra limbs", "fused body", "heavy armor", "robotic parts",
              "wrong perspective", "childish body", "chibi", "cartoon", "messy background",
              "animal hybrid", "bird head on human", "exaggerated muscles", "cleavage",
              "broken hands", "simplified shading"
            ];
            
            // 檢查是否包含負面關鍵詞
            const negativeKeywordCount = negativeKeywords.filter(keyword => 
              textLower.includes(keyword.toLowerCase())
            ).length;
            
            if (negativeKeywordCount >= 2) {
              isNegative = true;
            } else if (negativeKeywordCount >= 1 && textLower.length > 50) {
              // 如果包含負面關鍵詞且文本較長，可能是負面提示詞
              isNegative = true;
            }
          }
          // ✅ 3. 檢查節點標籤和類型
          if (!isNegative && (
            label.includes("negative") || 
            label.includes("neg") ||
            label.includes("bad") ||
            label.includes("unwanted") ||
            label.includes("負面") ||
            label.includes("负面") ||
            t.includes("negative") ||
            t.includes("Negative")
          )) {
            isNegative = true;
          }
          // ✅ 4. 檢查節點的輸出連接
          if (!isNegative && n?.outputs && Array.isArray(n.outputs)) {
            const hasNegativeOutput = n.outputs.some(output => {
              const outputStr = String(output || "").toLowerCase();
              return outputStr.includes("negative") || outputStr.includes("neg");
            });
            if (hasNegativeOutput) {
              isNegative = true;
            }
          }
          // ✅ 5. 檢查節點的輸入連接
          if (!isNegative && n?.inputs && typeof n.inputs === "object") {
            const inputsStr = JSON.stringify(n.inputs).toLowerCase();
            if (inputsStr.includes("negative") || inputsStr.includes("neg")) {
              isNegative = true;
            }
          }
          
          
          // ✅ 優先使用連接關係判斷（最準確）
          // 如果連接關係明確，直接使用連接關係，忽略內容判斷
          if (connectionType === "negative") {
            found.negativePrompts.push(directText.trim());
          } else if (connectionType === "positive") {
            found.positivePrompts.push(directText.trim());
          } else {
            // 如果沒有連接關係，使用原有的判斷邏輯（但這應該很少發生）
            if (isNegative) {
              found.negativePrompts.push(directText.trim());
            } else {
              found.positivePrompts.push(directText.trim());
            }
          }
        }
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

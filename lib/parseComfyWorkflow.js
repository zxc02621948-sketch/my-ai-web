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

// ✅ 輔助函數：判斷字符串是否為模型文件名或其他非提示詞內容（提取到外部作用域，供多處使用）
function isNotPromptText(str) {
    if (!str || typeof str !== "string") return true;
    const s = str.trim();
    if (s.length === 0) return true;
    const sLower = s.toLowerCase();
    
  // ✅ 0.1. 優先檢查：純數字（很可能是 seed 或其他參數值）
  if (/^\d+$/.test(s)) {
      const numValue = parseInt(s, 10);
      if (numValue >= 0 && numValue <= 1000 && s.length <= 4) {
        return true; // 很可能是參數值
      }
    if (s.length > 10) {
      return true; // 很可能是 seed 值
      }
    }
    
    // ✅ 0.2. 優先檢查：如果包含提示詞常見字符（逗號、換行符、括號等），很可能是提示詞
    const hasPromptIndicators = s.includes(",") || 
                                s.includes("\n") || 
                                s.includes("(") || 
                                s.includes(")") ||
                                s.includes("，") || // 中文逗號
                                (s.split(/\s+/).length > 3 && s.length > 50); // 多個詞且較長
    
    // 如果包含提示詞常見字符，且長度合理，很可能是提示詞
    if (hasPromptIndicators && s.length > 20 && s.length < 5000) {
      return false; // 很可能是提示詞，不應該被過濾
    }
    
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
    if (!hasPromptIndicators) {
      const modelNamePattern = /^[A-Z][A-Za-z0-9_]+(v\d+)?(_\w+)?$/;
      if (modelNamePattern.test(s) && s.length < 100) {
        return true;
      }
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
    
  // ✅ 6.1. 檢查是否包含管道符（|），這通常是節點類型名稱或配置路徑
  // 例如：ShowText|pysssss, custom_nodes | 場景 等
  if (s.includes("|")) {
    return true;
  }
  
  // ✅ 6.2. 檢查是否為採樣器設置（如 "nearest-exact", "euler", "dpm" 等）
  const samplerTerms = ["nearest", "exact", "euler", "dpm", "ddim", "plms", "lms", "heun", "dpm2", "dpm++", "dpm2_a", "dpm++_2m", "dpm++_2m_karras", "dpm++_sde", "dpm++_sde_karras", "dpm_fast", "dpm_adaptive", "lms_karras", "dpm2_karras", "dpm2_a_karras"];
  if (samplerTerms.some(term => sLower.includes(term) && (sLower === term || sLower.includes(term + "-") || sLower.includes("-" + term)))) {
    return true;
  }
  
  // ✅ 6.3. 檢查是否為節點類型名稱模式（如 "ShowText|pysssss" 或單獨的節點類型）
  const nodeTypePatterns = ["showtext", "pysssss", "wildcard", "makiwildcards", "extractloratrigger", "poseselector", "randomloraselector", "loraloaderfromstring"];
  if (nodeTypePatterns.some(pattern => sLower.includes(pattern))) {
    return true;
  }
  
  // ✅ 6.4. 檢查是否為單一單詞且看起來像技術術語或文件名
    if (s.split(/\s+/).length === 1 && s.length < 50) {
      const techTerms = ["conditioning", "latent", "image", "model", "vae", "clip", "controlnet", "lora", "sampler", "scheduler"];
      if (techTerms.some(term => sLower === term)) {
        return true;
      }
    // ✅ 檢查是否為腳本或擴展標識符（如 "comfyui-custom-scripts"）
    if (sLower.includes("comfyui") || sLower.includes("custom") || sLower.includes("script") || sLower.includes("extension")) {
      return true;
    }
    // ✅ 檢查是否為文件名模式（包含下劃線或連字符，且沒有空格，且長度較短）
    if ((s.includes("_") || s.includes("-")) && !s.includes(" ") && s.length < 50 && 
          !s.includes(",") && !s.includes("\n") && !s.includes("(") && !s.includes(")")) {
        return true;
      }
    // ✅ 檢查是否為單詞組合（多個單詞用下劃線或連字符連接，且沒有空格，且沒有提示詞常見字符）
    if (/^[a-z0-9_\-]+$/i.test(s) && (s.split("_").length >= 2 || s.split("-").length >= 2) && s.length < 100 &&
          !s.includes(",") && !s.includes("\n") && !s.includes("(") && !s.includes(")")) {
        return true;
      }
    }
  
  // ✅ 6.5. 檢查是否包含 "custom_nodes" 或類似的配置路徑模式
  if (sLower.includes("custom_nodes") || sLower.includes("custom nodes")) {
    return true;
    }
    
    // ✅ 7. 檢查是否包含明顯的模型文件路徑模式
    if (s.includes("\\") || s.includes("/") || s.includes("models/") || s.includes("checkpoints/")) {
      return true;
    }
    
  // ✅ 8. 檢查是否為工作流說明文檔
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
    
  // ✅ 9. 檢查是否包含列表格式
    const listPattern = /^\d+[\.\)]\s+[^\n]{1,50}(\n\d+[\.\)]\s+[^\n]{1,50}){2,}/;
    if (listPattern.test(s)) {
      return true;
    }
    
  // ✅ 10. 檢查是否包含過多的中文說明性文字
    const chineseCount = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalLength = s.length;
    if (chineseCount > totalLength * 0.4 && totalLength > 200) {
      const hasDocStructure = docKeywords.some(keyword => s.includes(keyword)) ||
                             /^\d+[\.\)]\s/.test(s) ||
                             s.includes("：") || s.includes(":");
      if (hasDocStructure) {
        return true;
      }
    }
    
  // ✅ 11. 檢查是否為過長的單一文本塊
    if (s.length > 2000) {
      if (docKeywords.some(keyword => s.includes(keyword)) || /^\d+[\.\)]\s/.test(s)) {
        return true;
      }
    }
    
    return false;
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

  // ✅ 擴展：從更多位置提取提示詞
  // ✅ 重要：對於 CLIPTextEncode 節點，提示詞通常存儲在 widgets_values[0] 中
  // inputs 字段通常是連接信息（如 clip 連接），而不是提示詞文本
  // 所以我們優先檢查 widgets_values
  
  // ✅ 重要：排除 textconcatenate 節點，它的文本應該從輸入節點中提取，而不是直接提取
  const nodeTypeStr = nodeType(node);
  if (nodeTypeStr.includes("textconcatenate") || nodeTypeStr.includes("concatenate")) {
    if (process.env.NODE_ENV === 'development') {
      const nodeId = node?.id ?? node?._meta?.id ?? 'unknown';
      console.log(`🔍 extractPrompt: 跳過 textconcatenate 節點 ${nodeId}，應該從輸入節點提取`);
    }
    return null;
  }
  
  let text = null;
  let isNegativeFromField = false;
  
  // 1. 優先從 widgets_values 提取（ComfyUI 標準格式）
  const widgets = node?.widgets_values;
  if (Array.isArray(widgets) && widgets.length > 0) {
    // CLIPTextEncode 的 widgets_values[0] 通常是提示詞文本
    for (let i = 0; i < widgets.length; i++) {
      const w = widgets[i];
      if (typeof w === "string" && w.length > 10) {
        // 使用更嚴格的過濾
        const isNotPrompt = isNotPromptText(w);
        // ✅ 調試日誌：記錄過濾結果
        if (process.env.NODE_ENV === 'development') {
          if (isNotPrompt) {
            console.log(`🔍 extractPrompt: widgets_values[${i}] 被過濾:`, {
              text: w.substring(0, 100) + '...',
              length: w.length,
              reason: 'isNotPromptText returned true'
            });
          } else {
            console.log(`✅ extractPrompt: widgets_values[${i}] 通過過濾:`, {
              text: w.substring(0, 100) + '...',
              length: w.length
            });
          }
        }
        if (!isNotPrompt) {
          text = w;
          isNegativeFromField = false; // widgets_values 中的提示詞不一定是 negative
          break;
        }
      }
    }
  }
  
  // 2. 如果 widgets_values 沒有，嘗試從 inputs 提取（某些自定義節點可能使用 inputs）
  // ✅ 重要：對於 prompt chunk，提示詞通常存儲在 inputs.text 中
  if (!text) {
    // ✅ 調試日誌：在檢查 inputs 之前輸出詳細信息
    if (process.env.NODE_ENV === 'development') {
    const nodeId = node?.id ?? node?._meta?.id ?? 'unknown';
    const nodeTypeStr = nodeType(node);
      console.log(`🔍 extractPrompt: 檢查 inputs (節點 ${nodeId}, 類型 ${nodeTypeStr}):`, {
        hasInputs: !!node?.inputs,
        inputsType: typeof node?.inputs,
        inputsIsArray: Array.isArray(node?.inputs),
        inputsKeys: node?.inputs && typeof node?.inputs === 'object' ? Object.keys(node.inputs) : [],
        inputsText: node?.inputs?.text,
        inputsTextType: typeof node?.inputs?.text,
        inputsTextIsArray: Array.isArray(node?.inputs?.text),
        inputsTextValue: typeof node?.inputs?.text === 'string' ? node.inputs.text.substring(0, 100) + '...' : JSON.stringify(node?.inputs?.text)?.substring(0, 100),
        inputsClip: node?.inputs?.clip,
        inputsClipType: typeof node?.inputs?.clip,
        allInputs: node?.inputs && typeof node?.inputs === 'object' ? Object.keys(node.inputs).reduce((acc, key) => {
          const value = node.inputs[key];
          if (typeof value === 'string' && value.length > 10) {
            acc[key] = value.substring(0, 50) + '...';
          } else {
            acc[key] = typeof value;
          }
          return acc;
        }, {}) : null
      });
    }
    // ✅ 重要：先檢查是否有明確的 negative 字段，這是最準確的判斷方式
    text = pickField(node, [
      "inputs.negative",  // ✅ 優先檢查 negative 字段
      "properties.negative"
    ]);
    isNegativeFromField = !!text; // 記錄是否從 negative 字段提取
    
    // 如果沒有 negative 字段，再檢查其他字段
    if (!text) {
      // ✅ 改進：如果 inputs 是數組，嘗試從數組中查找 text 字段
      if (Array.isArray(node?.inputs)) {
        const textInput = node.inputs.find(input => 
          input && typeof input === "object" && 
          (input.name === "text" || input.localized_name === "text" || 
           input.name === "prompt" || input.localized_name === "prompt" ||
           input.name === "positive" || input.localized_name === "positive" ||
           input.name === "negative" || input.localized_name === "negative")
        );
        if (textInput && textInput.widget && textInput.widget.value) {
          text = textInput.widget.value;
        }
      } else if (node?.inputs && typeof node.inputs === "object") {
        // ✅ 如果 inputs 是對象，直接檢查 inputs.text（prompt chunk 格式）
        // ✅ 重要：prompt chunk 中的 inputs.text 是字符串，不是連接對象
        // ✅ 但 workflow chunk 中的 inputs.text 可能是連接對象 [nodeId, outputIndex]
        if (node.inputs.text !== undefined) {
          if (typeof node.inputs.text === "string" && node.inputs.text.length > 10) {
            // ✅ prompt chunk 格式：inputs.text 是字符串
            text = node.inputs.text;
            // ✅ 調試日誌
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ extractPrompt: 從 inputs.text 提取提示詞 (字符串格式): length=${text.length}, preview=${text.substring(0, 50)}...`);
            }
          } else if (Array.isArray(node.inputs.text) && node.inputs.text.length === 2) {
            // ✅ workflow chunk 格式：inputs.text 是連接對象 [nodeId, outputIndex]
            // 這種情況下，需要從連接的節點中提取文本
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔍 extractPrompt: inputs.text 是連接對象 [${node.inputs.text[0]}, ${node.inputs.text[1]}]，需要從連接節點提取`);
            }
            // 這種情況會在後續的連接節點提取邏輯中處理
            text = null;
      } else {
            // ✅ 其他格式：嘗試使用 pickField（兼容其他格式）
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔍 extractPrompt: inputs.text 格式異常: type=${typeof node.inputs.text}, value=${JSON.stringify(node.inputs.text)?.substring(0, 100)}`);
            }
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
        } else {
          // ✅ 如果 inputs.text 不存在，嘗試使用 pickField（兼容其他格式）
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 extractPrompt: inputs.text 不存在，嘗試其他字段`);
          }
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
      }
    }
    
    // ✅ 確保 text 是字符串類型
    if (text && typeof text !== "string") {
      // 如果不是字符串，嘗試轉換
      if (Array.isArray(text)) {
        // 如果是數組，嘗試提取第一個字符串元素
        text = text.find(item => typeof item === "string" && item.length > 10) || null;
      } else if (typeof text === "object" && text !== null) {
        // 如果是對象，嘗試提取 value 字段
        text = text.value || text.text || text.prompt || null;
        if (text && typeof text !== "string") {
          text = null;
        }
      } else {
        text = String(text);
        // 如果轉換後的字符串太短或不符合要求，設為 null
        if (text.length < 10 || isNotPromptText(text)) {
          text = null;
        }
      }
    }
    
    // 過濾掉模型文件名等非提示詞內容
    if (text && typeof text === "string" && isNotPromptText(text)) {
      // ✅ 調試日誌：記錄被過濾的原因
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 extractPrompt: inputs.text 被過濾: length=${text.length}, preview=${text.substring(0, 50)}...`);
      }
      text = null;
      isNegativeFromField = false;
    } else if (text && typeof text === "string" && process.env.NODE_ENV === 'development') {
      // ✅ 調試日誌：記錄成功提取
      console.log(`✅ extractPrompt: 從 inputs 成功提取提示詞: length=${text.length}, preview=${text.substring(0, 50)}...`);
    }
  }
  
  // 3. 如果還是沒有，嘗試從整個節點中搜索可能的文本字段
  // ✅ 重要：排除節點標籤和元數據字段，只搜索實際的輸入數據
  if (!text && node) {
    // 遞歸搜索節點對象中的字符串字段
    const searchForText = (obj, depth = 0, parentKey = "") => {
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
          // ✅ 重要：排除節點標籤和元數據字段（這些不是實際的提示詞）
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
              key === "prefix" ||
              key === "title" ||  // ✅ 排除節點標題
              key === "name" ||   // ✅ 排除節點名稱
              key === "label" ||  // ✅ 排除節點標籤
              (parentKey === "_meta" && (key === "title" || key === "name" || key === "label")) || // ✅ 排除 _meta.title/name/label
              key === "_meta") {  // ✅ 排除整個 _meta 對象（避免提取節點標籤）
            continue;
          }
          const result = searchForText(obj[key], depth + 1, key);
          if (result) return result;
        }
      }
      return null;
    };
    text = searchForText(node);
  }
  
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    // ✅ 調試日誌：如果最終沒有提取到文本
    if (process.env.NODE_ENV === 'development') {
      const nodeId = node?.id ?? node?._meta?.id ?? 'unknown';
      const nodeTypeStr = nodeType(node);
      console.warn(`⚠️ extractPrompt: 節點 ${nodeId} (${nodeTypeStr}) 最終未提取到提示詞`, {
        hasWidgets: Array.isArray(widgets) && widgets.length > 0,
        widgetsLength: widgets?.length || 0,
        widgetsPreview: widgets?.map(w => typeof w === 'string' ? w.substring(0, 50) + '...' : String(w)).slice(0, 3),
        hasInputs: !!node?.inputs,
        inputsKeys: node?.inputs && typeof node?.inputs === 'object' ? Object.keys(node.inputs) : [],
        inputsText: node?.inputs?.text,
        inputsTextType: typeof node?.inputs?.text,
        inputsTextLength: typeof node?.inputs?.text === 'string' ? node.inputs.text.length : 0,
        inputsTextIsArray: Array.isArray(node?.inputs?.text),
        inputsTextValue: typeof node?.inputs?.text === 'string' ? node.inputs.text.substring(0, 100) + '...' : (Array.isArray(node?.inputs?.text) ? `[${node.inputs.text.join(', ')}]` : JSON.stringify(node?.inputs?.text)?.substring(0, 100))
      });
    }
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
  const nodeIndexToId = new Map(); // ✅ 新增：索引到 ID 的映射，用於備用查找
  
  // ✅ 重要：對於 prompt chunk，節點可能以數字 ID 為鍵存儲在 wfObj 中
  // 例如：{"1": {...}, "2": {...}, "17": {...}}
  // 需要將這些節點也加入到 nodeIdToNode 映射中
  if (typeof wfObj === 'object' && wfObj !== null) {
    // 檢查是否是以數字 ID 為鍵的格式（prompt chunk 格式）
    const numericKeys = Object.keys(wfObj).filter(key => /^\d+$/.test(key));
    if (numericKeys.length > 0 && numericKeys.length === Object.keys(wfObj).length - (wfObj.links ? 1 : 0)) {
      // 這可能是 prompt chunk 格式，將所有節點加入映射
      numericKeys.forEach(key => {
        const node = wfObj[key];
        if (node && typeof node === 'object') {
          const nodeId = parseInt(key, 10);
          nodeIdToNode.set(nodeId, node);
          nodeIdToNode.set(key, node); // 同時支持字符串和數字 ID
        }
      });
    }
  }
  
  // ✅ 改進：如果節點沒有 id，使用數組索引作為備用 ID（用於簡化的工作流 JSON）
  nodes.forEach((n, index) => {
    let nodeId = n?.id ?? n?._meta?.id;
    // ✅ 如果沒有 id，嘗試從 _meta 的其他字段獲取，或使用索引
    if (nodeId === undefined) {
      // 某些簡化的工作流 JSON 可能將 ID 存儲在其他位置
      nodeId = n?._meta?.nodeId ?? n?._meta?.uuid ?? index;
    }
    if (nodeId !== undefined) {
      nodeIdToNode.set(nodeId, n);
      nodeIdToNode.set(String(nodeId), n); // 同時支持字符串和數字 ID
      nodeIndexToId.set(index, nodeId); // ✅ 記錄索引到 ID 的映射
    }
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
  
  // ✅ 改進：先收集所有連接到 KSampler 的提示詞節點，然後統一判斷
  // ✅ 重要：必須在 links 處理之前定義，因為可能從 KSampler inputs 中推斷連接關係
  const promptConnections = []; // [{ sourceNodeId, targetNodeId, targetInputIndex, sourceNode, sourceLabel }]
  
  // ✅ 如果 links 為空，嘗試從其他位置獲取（某些簡化的工作流 JSON 可能將 links 存儲在其他位置）
  if (links.length === 0) {
    const altLinks = wfObj?.extra?.links || wfObj?.connections || wfObj?.edges || [];
    if (Array.isArray(altLinks) && altLinks.length > 0) {
      // ✅ 如果找到備用 links，嘗試合併（但需要確保格式一致）
      links.push(...altLinks);
    }
    
    // ✅ 如果還是沒有 links，嘗試從節點的 inputs 中推斷連接關係
    // 某些工作流格式可能將連接信息存儲在節點的 inputs 中
    if (links.length === 0) {
      nodes.forEach((n, index) => {
        const t = nodeType(n);
        if (t.includes("ksampler")) {
          // 檢查 KSampler 的 inputs，找出連接的提示詞節點
          if (n.inputs && typeof n.inputs === "object") {
            Object.entries(n.inputs).forEach(([inputKey, inputValue]) => {
              // 如果 inputValue 是數組，可能是連接信息 [nodeId, outputIndex]
              if (Array.isArray(inputValue) && inputValue.length >= 2) {
                const [sourceNodeId] = inputValue;
                const sourceNode = nodeIdToNode.get(sourceNodeId);
                if (sourceNode) {
                  const sourceType = nodeType(sourceNode);
                  if (sourceType.includes("cliptextencode") || 
                      sourceType.includes("textencode") ||
                      sourceType.includes("prompt")) {
                    // 推斷這是一個提示詞連接
                    const sourceLabel = lower(sourceNode?._meta?.title || sourceNode?.name || sourceNode?.label || "");
                    const finalSourceNodeId = sourceNode?.id ?? sourceNode?._meta?.id ?? sourceNodeId;
                    let kSamplerId = n?.id ?? n?._meta?.id;
                    if (kSamplerId === undefined) {
                      kSamplerId = n?._meta?.nodeId ?? n?._meta?.uuid ?? index;
                    }
                    // 嘗試推斷 targetInputIndex（通過 inputKey 或位置）
                    let targetInputIndex = null;
                    if (inputKey.includes("positive") || inputKey.includes("pos")) {
                      targetInputIndex = 1; // 假設 positive 是索引 1
                    } else if (inputKey.includes("negative") || inputKey.includes("neg")) {
                      targetInputIndex = 2; // 假設 negative 是索引 2
                    }
                    if (targetInputIndex !== null) {
                      promptConnections.push({
                        sourceNodeId: finalSourceNodeId,
                        originalSourceNodeId: sourceNodeId,
                        targetNodeId: kSamplerId,
                        targetInputIndex,
                        sourceNode,
                        sourceLabel
                      });
                    }
                  }
                }
              }
            });
          }
        }
      });
    }
  }

  // ✅ 分析 links，找出哪些節點連接到 KSampler 的 positive/negative
  const promptNodeConnection = new Map(); // nodeId -> "positive" | "negative" | null
  
  // ✅ 新增：追踪连接到 CLIPTextEncode 的文本输入节点
  const textEncodeToTextNodes = new Map(); // textEncodeNodeId -> [sourceNodeId1, sourceNodeId2, ...]
  
  // ✅ 新增：追踪所有 CLIPTextEncode 节点
  const textEncodeNodes = new Map(); // nodeId -> node
  
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
  
  // ✅ promptConnections 已在上面定義，這裡直接使用
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
    
    // ✅ 改進：如果 targetNodeId 不在 kSamplerNodes 中，嘗試使用索引查找
    let targetNode = null;
    if (kSamplerNodes.has(targetNodeId)) {
      targetNode = nodeIdToNode.get(targetNodeId);
    } else if (typeof targetNodeId === 'number' && targetNodeId < nodes.length) {
      // ✅ 如果 targetNodeId 是數字索引，嘗試直接使用
      const targetNodeByIndex = nodes[targetNodeId];
      if (targetNodeByIndex) {
        const targetType = nodeType(targetNodeByIndex);
        if (targetType.includes("ksampler")) {
          // 找到 KSampler，使用其 ID
          const actualTargetId = targetNodeByIndex?.id ?? targetNodeByIndex?._meta?.id ?? targetNodeId;
          if (actualTargetId !== undefined) {
            targetNodeId = actualTargetId;
            if (!kSamplerNodes.has(actualTargetId)) {
              kSamplerNodes.set(actualTargetId, { positiveInputIndex: null, negativeInputIndex: null });
            }
            targetNode = targetNodeByIndex;
          }
        }
      }
    }
    
    // 檢查目標是否是 KSampler
    if (targetNode && kSamplerNodes.has(targetNodeId)) {
      const sourceNode = nodeIdToNode.get(sourceNodeId);
      // ✅ 改進：如果 sourceNodeId 不在 nodeIdToNode 中，嘗試使用索引查找
      let actualSourceNode = sourceNode;
      if (!actualSourceNode && typeof sourceNodeId === 'number' && sourceNodeId < nodes.length) {
        actualSourceNode = nodes[sourceNodeId];
        if (actualSourceNode) {
          // 更新 sourceNodeId 為實際的 ID
          const actualSourceId = actualSourceNode?.id ?? actualSourceNode?._meta?.id ?? sourceNodeId;
          if (actualSourceId !== undefined) {
            sourceNodeId = actualSourceId;
            if (!nodeIdToNode.has(actualSourceId)) {
              nodeIdToNode.set(actualSourceId, actualSourceNode);
            }
          }
        }
      }
      
      if (!actualSourceNode) {
        return;
      }
      
      const sourceType = nodeType(actualSourceNode);
      // 只處理 CLIPTextEncode 類型的節點
      if (sourceType.includes("cliptextencode") || 
          sourceType.includes("textencode") ||
          sourceType.includes("prompt")) {
        const sourceLabel = lower(actualSourceNode?._meta?.title || actualSourceNode?.name || actualSourceNode?.label || "");
        // ✅ 確保 sourceNodeId 是實際的節點 ID（用於後續匹配）
        const finalSourceNodeId = actualSourceNode?.id ?? actualSourceNode?._meta?.id ?? sourceNodeId;
        promptConnections.push({
          sourceNodeId: finalSourceNodeId, // ✅ 使用實際的節點 ID
          originalSourceNodeId: sourceNodeId, // ✅ 保留原始的 sourceNodeId（用於調試）
          targetNodeId,
          targetInputIndex,
          sourceNode: actualSourceNode,
          sourceLabel
        });
        // ✅ 記錄這個 CLIPTextEncode 節點
        textEncodeNodes.set(finalSourceNodeId, actualSourceNode);
      }
    }
  });
  
  // ✅ 新增：追踪连接到 CLIPTextEncode 的文本输入节点
  links.forEach(link => {
    if (!Array.isArray(link) || link.length < 4) return;
    
    let sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex;
    
    if (link.length >= 6) {
      [, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else if (link.length === 5) {
      [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else if (link.length === 4) {
      [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
    } else {
      return;
    }
    
    // 檢查目標是否是 CLIPTextEncode 節點
    let targetNode = nodeIdToNode.get(targetNodeId);
    if (!targetNode && typeof targetNodeId === 'number' && targetNodeId < nodes.length) {
      targetNode = nodes[targetNodeId];
    }
    
    if (targetNode) {
      const targetType = nodeType(targetNode);
      // 如果目標是 CLIPTextEncode，且輸入是 text（通常是索引 1）
      if ((targetType.includes("cliptextencode") || targetType.includes("textencode")) && 
          (targetInputIndex === 1 || targetInputIndex === 0)) {
        // 檢查目標節點的輸入定義，確認是否是 text 輸入
        const targetInputs = targetNode?.inputs;
        if (Array.isArray(targetInputs) && targetInputs[targetInputIndex]) {
          const inputName = lower(targetInputs[targetInputIndex]?.localized_name || targetInputs[targetInputIndex]?.name || "");
          if (inputName.includes("text") || inputName.includes("prompt") || targetInputIndex === 1) {
            // 找到連接到 CLIPTextEncode 的文本節點
            let sourceNode = nodeIdToNode.get(sourceNodeId);
            if (!sourceNode && typeof sourceNodeId === 'number' && sourceNodeId < nodes.length) {
              sourceNode = nodes[sourceNodeId];
            }
            
            if (sourceNode) {
              const finalTargetNodeId = targetNode?.id ?? targetNode?._meta?.id ?? targetNodeId;
              const finalSourceNodeId = sourceNode?.id ?? sourceNode?._meta?.id ?? sourceNodeId;
              
              if (!textEncodeToTextNodes.has(finalTargetNodeId)) {
                textEncodeToTextNodes.set(finalTargetNodeId, []);
              }
              textEncodeToTextNodes.get(finalTargetNodeId).push(finalSourceNodeId);
            }
          }
        }
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
      // ✅ 使用 conn.sourceNodeId（已經在 promptConnections.push 時設置為正確的節點 ID）
      const sourceNodeId = conn.sourceNodeId;
      
      // ✅ 如果已經分類過，跳過
      if (promptNodeConnection.has(sourceNodeId)) {
        return;
      }
      
      // ✅ 方法1：通過 KSampler 的輸入映射判斷（最準確）
      if (inputMap) {
        if (inputMap.positiveIndex !== null && conn.targetInputIndex === inputMap.positiveIndex) {
          promptNodeConnection.set(sourceNodeId, "positive");
          return;
        }
        if (inputMap.negativeIndex !== null && conn.targetInputIndex === inputMap.negativeIndex) {
          promptNodeConnection.set(sourceNodeId, "negative");
          return;
        }
      }
      
      // ✅ 方法2：檢查 KSampler 節點的實際輸入定義（在標籤檢查之前，因為更準確）
      if (kSamplerNode && Array.isArray(kSamplerNode.inputs)) {
        const targetInput = kSamplerNode.inputs[conn.targetInputIndex];
        if (targetInput && typeof targetInput === "object") {
          const inputName = lower(targetInput.localized_name || targetInput.name || "");
          if (inputName.includes("positive") || inputName.includes("pos")) {
            promptNodeConnection.set(sourceNodeId, "positive");
            return;
          } else if (inputName.includes("negative") || inputName.includes("neg")) {
            promptNodeConnection.set(sourceNodeId, "negative");
            return;
          }
        }
      }
      
      // ✅ 方法3：檢查節點標題和類型（次準確，但非常可靠）
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
        promptNodeConnection.set(sourceNodeId, "negative");
        return;
      } else if (isPositiveByLabel) {
        promptNodeConnection.set(sourceNodeId, "positive");
        return;
      }
      
      // ✅ 方法4：通過輸入索引和相對位置判斷（備用方案）
      // 找出所有連接到同一個 KSampler 的其他提示詞節點
      const otherConnections = connections.filter(c => c.sourceNodeId !== sourceNodeId);
      
      // 如果已經有其他節點被標記，根據相對位置判斷
      const hasNegativeBefore = otherConnections.some(c => 
        promptNodeConnection.get(c.sourceNodeId) === "negative" && c.targetInputIndex < conn.targetInputIndex
      );
      const hasPositiveBefore = otherConnections.some(c => 
        promptNodeConnection.get(c.sourceNodeId) === "positive" && c.targetInputIndex < conn.targetInputIndex
      );
      
      if (hasNegativeBefore) {
        // 如果已經有 negative 在更前面的位置，這個可能是 positive（但這不太可能，因為 positive 通常在 negative 之前）
        promptNodeConnection.set(sourceNodeId, "positive");
        return;
      } else if (hasPositiveBefore) {
        // 如果已經有 positive 在更前面的位置，這個可能是 negative
        promptNodeConnection.set(sourceNodeId, "negative");
        return;
      }
      
      // ✅ 方法5：根據標準順序推測（最後備用方案）
      // 標準 KSampler 輸入順序：model(0), positive(1), negative(2), latent_image(3), ...
      // 如果索引是 1，通常是 positive
      if (conn.targetInputIndex === 1) {
        promptNodeConnection.set(sourceNodeId, "positive");
        return;
      }
      // 如果索引是 2，通常是 negative
      if (conn.targetInputIndex === 2) {
        promptNodeConnection.set(sourceNodeId, "negative");
        return;
      }
      // 如果索引 < 3，且沒有其他節點在更小的索引，可能是 positive（因為 positive 在 negative 之前）
      if (conn.targetInputIndex < 3) {
        const smallerIndexConnections = otherConnections.filter(c => c.targetInputIndex < conn.targetInputIndex);
        if (smallerIndexConnections.length === 0) {
          promptNodeConnection.set(sourceNodeId, "positive");
          return;
        }
      }
      
      // ✅ 如果所有方法都失敗，根據兩個連接的相對位置判斷
      // 如果只有兩個連接，索引較小的通常是 positive，較大的通常是 negative
      if (connections.length === 2) {
        const otherConn = otherConnections[0];
        if (otherConn) {
          if (conn.targetInputIndex < otherConn.targetInputIndex) {
            promptNodeConnection.set(sourceNodeId, "positive");
          } else {
            promptNodeConnection.set(sourceNodeId, "negative");
          }
        }
      }
    });
  });
  

  // ✅ 記錄已經作為 textconcatenate 輸入被提取的節點，避免重複提取
  const textconcatenateInputNodes = new Set();

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
      // ✅ 改進：如果使用索引作為 ID，嘗試從 nodeIndexToId 獲取實際 ID
      if (typeof nodeId === 'number' && nodeIndexToId.has(nodeId)) {
        nodeId = nodeIndexToId.get(nodeId);
      }
    }
    
    // ✅ 如果這個節點已經作為 textconcatenate 的輸入被提取，跳過單獨提取
    if (nodeId !== undefined && nodeId !== null && textconcatenateInputNodes.has(nodeId)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 跳過節點 ${nodeId}，它已經作為 textconcatenate 輸入被提取`);
      }
      continue;
    }
    
    // ✅ 改進：嘗試多種方式查找連接關係
    let connectionType = promptNodeConnection.get(nodeId); // "positive" | "negative" | null
    
    // ✅ 如果沒找到，嘗試使用節點索引查找
    if (!connectionType) {
      const nodeIndex = nodes.indexOf(n);
      if (nodeIndexToId.has(nodeIndex)) {
        const actualId = nodeIndexToId.get(nodeIndex);
        connectionType = promptNodeConnection.get(actualId);
      }
    }
    
    // ✅ 如果還是沒找到，嘗試直接使用節點索引作為 key
    if (!connectionType && typeof nodeId === 'number') {
      connectionType = promptNodeConnection.get(nodeId);
    }
    
    // ✅ 優先：使用專門的 extractPrompt 函數（已增強，支持更多節點類型）
    let prompt = extractPrompt(n);
    let finalPromptText = prompt?.text;
    
    // ✅ 新增：如果 extractPrompt 沒有提取到文本，且 inputs.text 是連接對象，直接從對應節點提取
    if (!finalPromptText && n?.inputs?.text && Array.isArray(n.inputs.text) && n.inputs.text.length === 2) {
      const [connectedNodeId, outputIndex] = n.inputs.text;
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 嘗試從連接節點 ${connectedNodeId} 提取提示詞 (當前節點: ${nodeId}, 類型: ${nodeType(n)})`);
      }
      
      // ✅ 嘗試從 nodeIdToNode 映射中獲取連接的節點
      let connectedNode = nodeIdToNode.get(connectedNodeId) || 
                          nodeIdToNode.get(String(connectedNodeId)) ||
                          nodeIdToNode.get(Number(connectedNodeId));
      
      if (process.env.NODE_ENV === 'development' && !connectedNode) {
        console.log(`🔍 nodeIdToNode 中沒有找到節點 ${connectedNodeId}，嘗試從 wfObj 獲取`);
        console.log(`🔍 nodeIdToNode 的鍵:`, Array.from(nodeIdToNode.keys()).slice(0, 20));
      }
      
      // ✅ 如果沒找到，嘗試從 wfObj 中獲取（prompt chunk 格式）
      if (!connectedNode && wfObj && typeof wfObj === 'object') {
        const nodeKey = String(connectedNodeId);
        if (wfObj[nodeKey] && typeof wfObj[nodeKey] === 'object') {
          connectedNode = wfObj[nodeKey];
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 從 wfObj[${nodeKey}] 找到連接節點`);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 wfObj[${nodeKey}] 不存在或不是對象`);
          console.log(`🔍 wfObj 的鍵:`, Object.keys(wfObj).slice(0, 20));
        }
      }
      
      if (connectedNode) {
        const connectedNodeType = nodeType(connectedNode);
        
        // ✅ 特殊處理：如果連接節點是 textconcatenate，需要從它的輸入節點中提取文本
        if (connectedNodeType.includes("textconcatenate") || connectedNodeType.includes("concatenate")) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 連接節點 ${connectedNodeId} 是 textconcatenate，從輸入節點提取文本`);
            console.log(`🔍 textconcatenate 節點的 inputs:`, connectedNode?.inputs);
            console.log(`🔍 textconcatenate 節點的 inputs 鍵:`, connectedNode?.inputs ? Object.keys(connectedNode.inputs) : []);
          }
          
          // 獲取 textconcatenate 的分隔符和 text_count
          const delimiter = connectedNode?.inputs?.delimiter || 
                           connectedNode?.widgets_values?.[1] || 
                           ", ";
          const textCount = connectedNode?.inputs?.text_count || 
                           connectedNode?.widgets_values?.[0] || 
                           3;
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 textconcatenate 參數: delimiter="${delimiter}", textCount=${textCount}`);
          }
          
          // ✅ 先檢查 textconcatenate 節點是否有輸出字段（prompt chunk 中可能包含實際拼接後的文本）
          let concatenatedText = null;
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 textconcatenate 節點 ${connectedNodeId} 的 outputs 檢查:`, {
              hasOutputs: !!connectedNode?.outputs,
              outputsType: typeof connectedNode?.outputs,
              outputsKeys: connectedNode?.outputs && typeof connectedNode.outputs === 'object' ? Object.keys(connectedNode.outputs) : null,
              outputsPreview: connectedNode?.outputs ? JSON.stringify(connectedNode.outputs, null, 2).substring(0, 500) : null
            });
          }
          if (connectedNode?.outputs && typeof connectedNode.outputs === 'object') {
            for (const key in connectedNode.outputs) {
              const value = connectedNode.outputs[key];
              if (typeof value === 'string' && value.length > 0 && !isNotPromptText(value)) {
                concatenatedText = value;
                if (process.env.NODE_ENV === 'development') {
                  console.log(`✅ textconcatenate 節點 ${connectedNodeId} 從 outputs.${key} 提取拼接後的文本: length=${concatenatedText.length}, preview=${concatenatedText.substring(0, 50)}...`);
                }
                break;
              }
            }
          }
          
          // 從 inputs 中提取所有 text_* 字段的值
          const concatenateTextParts = [];
          if (!concatenatedText && connectedNode?.inputs && typeof connectedNode.inputs === 'object') {
            // 遍歷所有 text_* 字段（text_1, text_2, text_3, ...）
            for (let i = 1; i <= textCount; i++) {
              const textKey = `text_${i}`;
              const textValue = connectedNode.inputs[textKey];
              
              if (process.env.NODE_ENV === 'development') {
                let valueDisplay = '';
                if (typeof textValue === 'string') {
                  valueDisplay = textValue.length <= 100 ? textValue : textValue.substring(0, 100) + '...';
                } else if (Array.isArray(textValue)) {
                  valueDisplay = `[${textValue.join(', ')}]`;
                } else {
                  valueDisplay = JSON.stringify(textValue)?.substring(0, 200) || String(textValue);
                }
                console.log(`🔍 檢查 textconcatenate text_${i}:`, {
                  exists: textValue !== undefined,
                  type: typeof textValue,
                  isArray: Array.isArray(textValue),
                  isString: typeof textValue === 'string',
                  value: valueDisplay,
                  length: typeof textValue === 'string' ? textValue.length : undefined
                });
              }
              
              if (textValue !== undefined) {
                if (typeof textValue === 'string' && textValue.trim().length > 0) {
                  // 直接是字符串，直接使用（移除長度限制，因為短字符串也可能是有效提示詞）
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`🔍 textconcatenate text_${i} 字符串內容: length=${textValue.length}, value="${textValue}", isFiltered=${isNotPromptText(textValue)}`);
                  }
                  if (!isNotPromptText(textValue)) {
                    concatenateTextParts.push(textValue);
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ textconcatenate text_${i} 是字符串: length=${textValue.length}, preview=${textValue.substring(0, 50)}...`);
                    }
                  } else if (process.env.NODE_ENV === 'development') {
                    console.log(`⚠️ textconcatenate text_${i} 字符串被過濾: "${textValue.substring(0, 50)}..."`);
                  }
                } else if (Array.isArray(textValue) && textValue.length === 2) {
                  // 是連接對象 [nodeId, outputIndex]，遞歸提取
                  const [nestedNodeId, nestedOutputIndex] = textValue;
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`🔍 textconcatenate text_${i} 嘗試從連接節點 ${nestedNodeId} 提取`);
                  }
                  
                  let nestedNode = nodeIdToNode.get(nestedNodeId) || 
                                  nodeIdToNode.get(String(nestedNodeId)) ||
                                  nodeIdToNode.get(Number(nestedNodeId));
                  
                  // 如果沒找到，嘗試從 wfObj 中獲取
                  if (!nestedNode && wfObj && typeof wfObj === 'object') {
                    const nestedNodeKey = String(nestedNodeId);
                    if (wfObj[nestedNodeKey] && typeof wfObj[nestedNodeKey] === 'object') {
                      nestedNode = wfObj[nestedNodeKey];
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`✅ 從 wfObj 找到連接節點 ${nestedNodeId}`);
                      }
                    }
                  }
                  
                  if (nestedNode) {
                    // 先檢查節點的類型和內容
                    const nestedNodeType = nodeType(nestedNode);
                    if (process.env.NODE_ENV === 'development') {
                      // 收集所有 inputs 中的字符串字段
                      const inputsStrings = {};
                      if (nestedNode?.inputs && typeof nestedNode.inputs === 'object') {
                        for (const key in nestedNode.inputs) {
                          const value = nestedNode.inputs[key];
                          if (typeof value === 'string' && value.length > 0) {
                            inputsStrings[key] = value.length <= 100 ? value : value.substring(0, 100) + '...';
                          }
                        }
                      }
                      
                      console.log(`🔍 連接節點 ${nestedNodeId} 的詳細信息:`, {
                        type: nestedNodeType,
                        hasInputs: !!nestedNode?.inputs,
                        inputsKeys: nestedNode?.inputs && typeof nestedNode.inputs === 'object' ? Object.keys(nestedNode.inputs) : null,
                        inputsText: nestedNode?.inputs?.text,
                        inputsTextType: typeof nestedNode?.inputs?.text,
                        inputsTextLength: typeof nestedNode?.inputs?.text === 'string' ? nestedNode.inputs.text.length : undefined,
                        inputsStrings: Object.keys(inputsStrings).length > 0 ? inputsStrings : null,
                        hasWidgets: !!nestedNode?.widgets_values,
                        widgetsLength: nestedNode?.widgets_values?.length || 0,
                        widgetsPreview: nestedNode?.widgets_values?.slice(0, 3)
                      });
                    }
                    
                    // ✅ 特殊處理：對於 PrimitiveString 和 makiwildcards 節點，檢查所有可能的文本字段
                    let extractedText = null;
                    if (nestedNodeType.includes("primitivestring") || nestedNodeType.includes("primitive") || 
                        nestedNodeType.includes("makiwildcards") || nestedNodeType.includes("wildcard")) {
                      // 在 prompt chunk 中，這些節點的文本可能已經被替換為實際值
                      // 1. 先檢查 inputs.text
                      if (nestedNode?.inputs?.text && typeof nestedNode.inputs.text === 'string' && nestedNode.inputs.text.length > 0) {
                        if (!isNotPromptText(nestedNode.inputs.text)) {
                          extractedText = nestedNode.inputs.text;
                          if (process.env.NODE_ENV === 'development') {
                            console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 inputs.text 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                          }
                        }
                      }
                      
                      // 2. 如果沒有，檢查 inputs 中的所有字符串字段（排除配置字段）
                      if (!extractedText && nestedNode?.inputs && typeof nestedNode.inputs === 'object') {
                        // ✅ 優先檢查可能包含實際文本的字段
                        const priorityFields = ['text', 'value', 'result', 'output', 'content', 'string', 'prompt'];
                        for (const priorityKey of priorityFields) {
                          const value = nestedNode.inputs[priorityKey];
                          if (typeof value === 'string' && value.length > 0 && !isNotPromptText(value)) {
                            extractedText = value;
                            if (process.env.NODE_ENV === 'development') {
                              console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 inputs.${priorityKey} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                            }
                            break;
                          }
                        }
                        
                        // ✅ 如果優先字段沒有，再檢查其他字段（排除配置字段）
                        if (!extractedText) {
                          const excludeKeys = ['delimiter', 'clean_whitespace', 'replace_underscore', 'text_count', 
                                               'seed', 'random_seed', 'mode', 'type', 'class_type', 'id',
                                               'wildcards_count', 'wildcard_count']; // ✅ 排除 makiwildcards 的配置字段
                          // ✅ 對於 makiwildcards，優先檢查可能包含實際生成的文本的字段
                          const makiWildcardFields = [];
                          if (nestedNodeType.includes("makiwildcards") || nestedNodeType.includes("wildcard")) {
                            // 檢查是否有 wildcard_* 字段（可能包含實際生成的文本）
                            for (const key in nestedNode.inputs) {
                              if (key.startsWith('wildcard_') && typeof nestedNode.inputs[key] === 'string' && nestedNode.inputs[key].length > 5) {
                                makiWildcardFields.push(key);
                              }
                            }
                            // 先檢查 wildcard_* 字段
                            for (const key of makiWildcardFields) {
                              const value = nestedNode.inputs[key];
                              if (typeof value === 'string' && value.length > 5 && !isNotPromptText(value)) {
                                extractedText = value;
                                if (process.env.NODE_ENV === 'development') {
                                  console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 inputs.${key} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                                }
                                break;
                              }
                            }
                          }
                          // 如果 wildcard_* 字段沒有，再檢查其他字段
                          if (!extractedText) {
                            for (const key in nestedNode.inputs) {
                              // 跳過配置字段和已檢查的優先字段
                              if (excludeKeys.includes(key.toLowerCase()) || priorityFields.includes(key) || makiWildcardFields.includes(key)) {
                                continue;
                              }
                              const value = nestedNode.inputs[key];
                              // ✅ 對於 makiwildcards，跳過很短的字符串（可能是配置值）
                              if (typeof value === 'string' && value.length > 5 && !isNotPromptText(value)) {
                                extractedText = value;
                                if (process.env.NODE_ENV === 'development') {
                                  console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 inputs.${key} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                                }
                                break;
                              }
                            }
                          }
                        }
                      }
                      
                      // 3. 如果還是沒有，檢查 outputs 字段（prompt chunk 中可能包含實際輸出）
                      if (!extractedText && nestedNode?.outputs && typeof nestedNode.outputs === 'object') {
                        // 檢查 outputs 中的所有字符串字段
                        for (const key in nestedNode.outputs) {
                          const value = nestedNode.outputs[key];
                          if (typeof value === 'string' && value.length > 0 && !isNotPromptText(value)) {
                            extractedText = value;
                            if (process.env.NODE_ENV === 'development') {
                              console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 outputs.${key} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                            }
                            break;
                          }
                        }
                      }
                      
                      // 4. 如果還是沒有，檢查 widgets_values
                      if (!extractedText && nestedNode?.widgets_values && Array.isArray(nestedNode.widgets_values)) {
                        for (const w of nestedNode.widgets_values) {
                          if (typeof w === 'string' && w.length > 0 && !isNotPromptText(w)) {
                            extractedText = w;
                            if (process.env.NODE_ENV === 'development') {
                              console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 widgets_values 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                            }
                            break;
                          }
                        }
                      }
                      
                      // 5. 如果還是沒有，輸出完整結構用於調試
                      if (!extractedText && process.env.NODE_ENV === 'development') {
                        // ✅ 輸出所有 inputs 字段的详细信息
                        const allInputsInfo = {};
                        if (nestedNode?.inputs && typeof nestedNode.inputs === 'object') {
                          for (const key in nestedNode.inputs) {
                            const value = nestedNode.inputs[key];
                            if (typeof value === 'string') {
                              allInputsInfo[key] = {
                                type: 'string',
                                length: value.length,
                                preview: value.length <= 100 ? value : value.substring(0, 100) + '...',
                                isNotPrompt: isNotPromptText(value)
                              };
                            } else if (Array.isArray(value)) {
                              allInputsInfo[key] = {
                                type: 'array',
                                value: value
                              };
                            } else {
                              allInputsInfo[key] = {
                                type: typeof value,
                                value: value
                              };
                            }
                          }
                        }
                        // ✅ 輸出所有字符串字段的完整內容（用於調試）
                        const stringFields = {};
                        for (const key in allInputsInfo) {
                          if (allInputsInfo[key].type === 'string') {
                            const fullValue = nestedNode?.inputs?.[key];
                            stringFields[key] = {
                              length: allInputsInfo[key].length,
                              preview: allInputsInfo[key].preview,
                              isNotPrompt: allInputsInfo[key].isNotPrompt,
                              fullValue: fullValue // 輸出完整值
                            };
                            // ✅ 如果字符串長度 > 5 且沒有被過濾，嘗試使用它
                            if (fullValue && typeof fullValue === 'string' && fullValue.length > 5 && !isNotPromptText(fullValue)) {
                              extractedText = fullValue;
                              if (process.env.NODE_ENV === 'development') {
                                console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 stringFields.${key} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                              }
                              break; // 找到第一個有效文本就停止
                            }
                          }
                        }
                        // ✅ 如果還是沒有，檢查 outputs 字段
                        if (!extractedText && nestedNode?.outputs && typeof nestedNode.outputs === 'object') {
                          for (const key in nestedNode.outputs) {
                            const value = nestedNode.outputs[key];
                            if (typeof value === 'string' && value.length > 5 && !isNotPromptText(value)) {
                              extractedText = value;
                              if (process.env.NODE_ENV === 'development') {
                                console.log(`✅ ${nestedNodeType} 節點 ${nestedNodeId} 從 outputs.${key} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                              }
                              break;
                            }
                          }
                        }
                        if (!extractedText) {
                          // ✅ 輸出 stringFields 的完整內容（展開每個字段的 fullValue）
                          const stringFieldsExpanded = {};
                          for (const key in stringFields) {
                            stringFieldsExpanded[key] = {
                              length: stringFields[key].length,
                              preview: stringFields[key].preview,
                              isNotPrompt: stringFields[key].isNotPrompt,
                              fullValue: stringFields[key].fullValue ? String(stringFields[key].fullValue).substring(0, 200) : null
                            };
                          }
                          console.warn(`⚠️ ${nestedNodeType} 節點 ${nestedNodeId} 未能提取文本`, {
                            allInputsInfo: allInputsInfo,
                            stringFields: stringFieldsExpanded,
                            hasOutputs: !!nestedNode?.outputs,
                            outputsKeys: nestedNode?.outputs && typeof nestedNode.outputs === 'object' ? Object.keys(nestedNode.outputs) : null,
                            outputsPreview: nestedNode?.outputs ? JSON.stringify(nestedNode.outputs, null, 2).substring(0, 1000) : null,
                            fullStructure: JSON.stringify(nestedNode, null, 2).substring(0, 5000)
                          });
                        }
                      }
                    }
                    
                    // 如果特殊處理沒有提取到文本，使用 extractPrompt
                    if (!extractedText) {
                      const nestedPrompt = extractPrompt(nestedNode);
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`🔍 連接節點 ${nestedNodeId} 的 extractPrompt 結果:`, {
                          hasText: !!nestedPrompt?.text,
                          textLength: nestedPrompt?.text?.length || 0,
                          textPreview: nestedPrompt?.text?.substring(0, 50) || 'null',
                          isNegative: nestedPrompt?.isNegative
                        });
                      }
                      if (nestedPrompt?.text && !isNotPromptText(nestedPrompt.text)) {
                        extractedText = nestedPrompt.text;
                      }
                    }
                    
                    // 如果提取到文本，添加到拼接列表
                    if (extractedText && !isNotPromptText(extractedText)) {
                      concatenateTextParts.push(extractedText);
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`✅ textconcatenate text_${i} 從連接節點 ${nestedNodeId} 提取: length=${extractedText.length}, preview=${extractedText.substring(0, 50)}...`);
                      }
                    } else if (process.env.NODE_ENV === 'development') {
                      console.warn(`⚠️ textconcatenate text_${i} 連接節點 ${nestedNodeId} 提取失敗或文本被過濾`, {
                        hasExtractedText: !!extractedText,
                        textLength: extractedText?.length || 0,
                        isFiltered: extractedText ? isNotPromptText(extractedText) : false,
                        nodeType: nestedNodeType
                      });
                    }
                  } else if (process.env.NODE_ENV === 'development') {
                    console.warn(`⚠️ textconcatenate text_${i} 連接節點 ${nestedNodeId} 不存在`, {
                      nodeIdToNodeSize: nodeIdToNode.size,
                      wfObjKeys: wfObj && typeof wfObj === 'object' ? Object.keys(wfObj).slice(0, 10) : null
                    });
                  }
                }
              }
            }
          }
          
          // 按照分隔符拼接（如果沒有從 outputs 提取到文本）
          if (!concatenatedText && concatenateTextParts.length > 0) {
            finalPromptText = concatenateTextParts.join(delimiter);
          } else if (concatenatedText) {
            finalPromptText = concatenatedText;
            // ✅ 使用第一個非空文本的 isNegative 判斷（通常所有部分都是同一類型）
            let isNegative = false;
            if (connectedNode?.inputs && typeof connectedNode.inputs === 'object') {
              for (let i = 1; i <= textCount; i++) {
                const textKey = `text_${i}`;
                const textValue = connectedNode.inputs[textKey];
                if (textValue !== undefined) {
                  if (typeof textValue === 'string') {
                    const tempPrompt = extractPrompt({ inputs: { text: textValue } });
                    if (tempPrompt?.isNegative) {
                      isNegative = true;
                      break;
                    }
                  } else if (Array.isArray(textValue) && textValue.length === 2) {
                    const [nestedNodeId] = textValue;
                    let nestedNode = nodeIdToNode.get(nestedNodeId) || 
                                    nodeIdToNode.get(String(nestedNodeId)) ||
                                    nodeIdToNode.get(Number(nestedNodeId));
                    if (!nestedNode && wfObj && typeof wfObj === 'object') {
                      const nestedNodeKey = String(nestedNodeId);
                      if (wfObj[nestedNodeKey] && typeof wfObj[nestedNodeKey] === 'object') {
                        nestedNode = wfObj[nestedNodeKey];
                      }
                    }
                    if (nestedNode) {
                      const nestedPrompt = extractPrompt(nestedNode);
                      if (nestedPrompt?.isNegative) {
                        isNegative = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
            
            if (prompt) {
              prompt.isNegative = isNegative;
            } else {
              prompt = { text: finalPromptText, isNegative: isNegative };
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ 從 textconcatenate 節點 ${connectedNodeId} 提取提示詞: length=${finalPromptText.length}, preview=${finalPromptText.substring(0, 50)}...`);
            }
          } else if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ textconcatenate 節點 ${connectedNodeId} 沒有提取到任何文本部分`);
          }
        } else {
          // ✅ 普通節點：遞歸提取連接節點的文本
          const connectedPrompt = extractPrompt(connectedNode);
          if (connectedPrompt?.text) {
            finalPromptText = connectedPrompt.text;
            // ✅ 使用連接節點的 isNegative 判斷
            if (prompt) {
              prompt.isNegative = connectedPrompt.isNegative;
            } else {
              prompt = { text: finalPromptText, isNegative: connectedPrompt.isNegative };
            }
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ 從連接節點 ${connectedNodeId} 提取提示詞: length=${finalPromptText.length}, preview=${finalPromptText.substring(0, 50)}...`);
            }
          } else if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ 連接節點 ${connectedNodeId} 存在，但 extractPrompt 沒有提取到文本`);
            console.log(`🔍 連接節點的類型:`, connectedNodeType);
            console.log(`🔍 連接節點的 inputs:`, connectedNode?.inputs);
          }
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ 無法找到連接節點 ${connectedNodeId}，無法提取提示詞`);
        console.log(`🔍 當前節點 ID: ${nodeId}, 類型: ${nodeType(n)}`);
        console.log(`🔍 nodeIdToNode 大小: ${nodeIdToNode.size}`);
        console.log(`🔍 wfObj 類型: ${typeof wfObj}, 是否為對象: ${typeof wfObj === 'object' && wfObj !== null}`);
      }
    }
    
    // ✅ 新增：如果 CLIPTextEncode 節點的文本為空，嘗試從連接的文本節點提取
    if (!finalPromptText && (connectionType === "positive" || connectionType === "negative")) {
      // ✅ 調試：嘗試多種方式查找連接的文本節點
      let connectedTextNodes = textEncodeToTextNodes.get(nodeId);
      
      // ✅ 如果沒找到，嘗試使用節點索引查找
      if (!connectedTextNodes || connectedTextNodes.length === 0) {
        const nodeIndex = nodes.indexOf(n);
        if (nodeIndexToId.has(nodeIndex)) {
          const actualId = nodeIndexToId.get(nodeIndex);
          connectedTextNodes = textEncodeToTextNodes.get(actualId);
        }
      }
      
      // ✅ 如果還是沒找到，嘗試直接從 links 中查找
      if (!connectedTextNodes || connectedTextNodes.length === 0) {
        // 直接從 links 中查找連接到這個 CLIPTextEncode 的節點
        const directConnections = [];
        links.forEach(link => {
          if (!Array.isArray(link) || link.length < 4) return;
          
          let sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex;
          if (link.length >= 6) {
            [, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
          } else if (link.length === 5) {
            [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
          } else if (link.length === 4) {
            [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
          } else {
            return;
          }
          
          // 檢查目標是否是當前的 CLIPTextEncode 節點，且輸入是 text（通常是索引 1）
          const finalTargetNodeId = n?.id ?? n?._meta?.id ?? nodeId;
          let isTargetMatch = false;
          
          if (targetNodeId === finalTargetNodeId) {
            isTargetMatch = true;
          } else if (typeof targetNodeId === 'number' && typeof finalTargetNodeId === 'number') {
            if (targetNodeId === finalTargetNodeId) {
              isTargetMatch = true;
            } else if (targetNodeId < nodes.length) {
              const targetNodeByIndex = nodes[targetNodeId];
              const targetNodeById = targetNodeByIndex?.id ?? targetNodeByIndex?._meta?.id;
              if (targetNodeById === finalTargetNodeId || targetNodeById === nodeId) {
                isTargetMatch = true;
              }
            }
          }
          
          if (isTargetMatch && (targetInputIndex === 1 || targetInputIndex === 0)) {
            // 檢查輸入名稱是否是 text
            const targetInputs = n?.inputs;
            if (Array.isArray(targetInputs) && targetInputs[targetInputIndex]) {
              const inputName = lower(targetInputs[targetInputIndex]?.localized_name || targetInputs[targetInputIndex]?.name || "");
              if (inputName.includes("text") || inputName.includes("prompt") || targetInputIndex === 1) {
                const finalSourceNodeId = sourceNodeId;
                if (!directConnections.includes(finalSourceNodeId)) {
                  directConnections.push(finalSourceNodeId);
                }
              }
            } else if (targetInputIndex === 1) {
              // 如果沒有輸入定義，但索引是 1，通常也是 text 輸入
              const finalSourceNodeId = sourceNodeId;
              if (!directConnections.includes(finalSourceNodeId)) {
                directConnections.push(finalSourceNodeId);
              }
            }
          }
        });
        
        if (directConnections.length > 0) {
          connectedTextNodes = directConnections;
          // ✅ 調試日誌
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 直接從 links 找到連接的文本節點: textEncodeNodeId=${nodeId}, connectedNodes=${directConnections.length}`, directConnections);
          }
        }
      }
      
      if (connectedTextNodes && connectedTextNodes.length > 0) {
        // ✅ 調試日誌
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ 開始從連接的文本節點提取提示詞: textEncodeNodeId=${nodeId}, connectionType=${connectionType}, connectedNodes=${connectedTextNodes.length}`, connectedTextNodes);
        }
        // 從所有連接的文本節點提取文本
        const textParts = [];
        for (const textNodeId of connectedTextNodes) {
          let textNode = nodeIdToNode.get(textNodeId);
          if (!textNode && typeof textNodeId === 'number' && textNodeId < nodes.length) {
            textNode = nodes[textNodeId];
          }
          
          if (textNode) {
            const textNodeType = nodeType(textNode);
            
            // ✅ 特殊處理：如果是 textconcatenate 節點，需要遞歸提取所有輸入
            if (textNodeType.includes("textconcatenate") || textNodeType.includes("concatenate")) {
              // 獲取 textconcatenate 的分隔符（通常是 ", "）
              const delimiter = textNode?.widgets_values?.[1] || ", ";
              const textCount = textNode?.widgets_values?.[0] || 3;
              
              // ✅ 調試日誌
              if (process.env.NODE_ENV === 'development') {
                const textNodeId = textNode?.id ?? textNode?._meta?.id ?? textNodeId;
                console.log(`🔍 處理 textconcatenate 節點: nodeId=${textNodeId}, delimiter="${delimiter}", textCount=${textCount}`);
              }
              
              // 追踪 textconcatenate 的所有輸入（text_1, text_2, text_3, ...）
              const concatenateTextParts = [];
              
              // 從 links 中找到所有連接到這個 textconcatenate 的節點
              links.forEach(link => {
                if (!Array.isArray(link) || link.length < 4) return;
                
                let sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex;
                if (link.length >= 6) {
                  [, sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
                } else if (link.length === 5) {
                  [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
                } else if (link.length === 4) {
                  [sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex] = link;
                } else {
                  return;
                }
                
                // ✅ 改進：使用多種方式匹配目標節點 ID
                const finalTargetNodeId = textNode?.id ?? textNode?._meta?.id ?? textNodeId;
                let isTargetMatch = false;
                
                // 方法1：直接匹配
                if (targetNodeId === finalTargetNodeId) {
                  isTargetMatch = true;
                }
                // 方法2：數字索引匹配
                else if (typeof targetNodeId === 'number' && typeof finalTargetNodeId === 'number') {
                  if (targetNodeId === finalTargetNodeId) {
                    isTargetMatch = true;
                  } else if (targetNodeId < nodes.length) {
                    const targetNodeByIndex = nodes[targetNodeId];
                    if (targetNodeByIndex === textNode) {
                      isTargetMatch = true;
                    } else {
                      const targetNodeById = targetNodeByIndex?.id ?? targetNodeByIndex?._meta?.id;
                      if (targetNodeById === finalTargetNodeId || targetNodeById === textNodeId) {
                        isTargetMatch = true;
                      }
                    }
                  }
                }
                // 方法3：通過 nodeIndexToId 匹配
                else if (typeof targetNodeId === 'number' && nodeIndexToId.has(targetNodeId)) {
                  const actualId = nodeIndexToId.get(targetNodeId);
                  if (actualId === finalTargetNodeId || actualId === textNodeId) {
                    isTargetMatch = true;
                  }
                }
                // 方法4：通過節點對象直接匹配
                else if (typeof targetNodeId === 'number' && targetNodeId < nodes.length) {
                  const targetNodeByIndex = nodes[targetNodeId];
                  if (targetNodeByIndex === textNode) {
                    isTargetMatch = true;
                  }
                }
                
                // ✅ 調試日誌
                if (process.env.NODE_ENV === 'development' && isTargetMatch) {
                  console.log(`🔍 找到連接到 textconcatenate 的鏈接: targetNodeId=${targetNodeId}, finalTargetNodeId=${finalTargetNodeId}, targetInputIndex=${targetInputIndex}, sourceNodeId=${sourceNodeId}`);
                }
                
                if (isTargetMatch) {
                  // ✅ 改進：處理不同的 textconcatenate 輸入索引格式
                  // 格式1：text_count(0), delimiter(1), clean_whitespace(2), replace_underscore(3), text_1(4), text_2(5), ...
                  // 格式2：text_1(0), text_2(1), text_3(2), ... (某些工作流格式)
                  // 我們需要檢查 sourceNode 是否是文本節點，而不是參數節點
                  let sourceNode = nodeIdToNode.get(sourceNodeId);
                  if (!sourceNode && typeof sourceNodeId === 'number' && sourceNodeId < nodes.length) {
                    sourceNode = nodes[sourceNodeId];
                  }
                  
                  if (sourceNode) {
                    // ✅ 檢查 sourceNode 是否是文本節點（不是參數節點）
                    const sourceNodeType = nodeType(sourceNode);
                    const isTextNode = sourceNodeType.includes("string") || 
                                     sourceNodeType.includes("text") || 
                                     sourceNodeType.includes("prompt") ||
                                     sourceNodeType.includes("extract") ||
                                     sourceNodeType.includes("wildcard") ||
                                     sourceNodeType.includes("primitive");
                    
                    // ✅ 如果 targetInputIndex >= 4，肯定是文本輸入
                    // ✅ 如果 targetInputIndex < 4，需要檢查是否是文本節點
                    const isTextInput = targetInputIndex >= 4 || 
                                       (targetInputIndex < 4 && isTextNode && targetInputIndex >= 0 && targetInputIndex < textCount);
                    
                    if (isTextInput) {
                      // ✅ 調試日誌
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`🔍 匹配到 textconcatenate 輸入: targetInputIndex=${targetInputIndex}, textCount=${textCount}, sourceNodeId=${sourceNodeId}, sourceNodeType=${sourceNodeType}, isTextNode=${isTextNode}`);
                      }
                      
                      let extractedText = null;
                      
                      // 方法1：使用 extractPrompt 提取
                      const sourcePrompt = extractPrompt(sourceNode);
                      if (sourcePrompt?.text && sourcePrompt.text.length > 10) {
                        extractedText = sourcePrompt.text;
                      }
                      
                      // 方法2：如果 extractPrompt 沒找到，嘗試從 widgets_values 提取
                      if (!extractedText) {
                        const widgets = sourceNode?.widgets_values;
                        if (Array.isArray(widgets)) {
                          for (const widget of widgets) {
                            if (typeof widget === "string" && widget.length > 10) {
                              // ✅ 使用完整的 isNotPromptText 函數進行過濾
                              if (!isNotPromptText(widget)) {
                                extractedText = widget;
                                break;
                              }
                            }
                          }
                        }
                      }
                      
                      // 方法3：嘗試從 value 字段提取（PrimitiveString 節點）
                      if (!extractedText) {
                        const value = sourceNode?.widgets_values?.[0] || sourceNode?.inputs?.value;
                        if (typeof value === "string" && value.length > 10) {
                          // ✅ 使用完整的 isNotPromptText 函數進行過濾
                          if (!isNotPromptText(value)) {
                            extractedText = value;
                          }
                        }
                      }
                      
                      // ✅ 最終檢查：即使提取到了文本，也要用 isNotPromptText 再次過濾
                      if (extractedText && isNotPromptText(extractedText)) {
                        if (process.env.NODE_ENV === 'development') {
                          console.log(`🔍 過濾掉 textconcatenate 輸入文本: ${extractedText.substring(0, 50)}...`);
                        }
                        extractedText = null;
                      }
                      
                      if (extractedText) {
                        concatenateTextParts.push(extractedText);
                        // ✅ 記錄這個節點已經作為 textconcatenate 輸入被提取，避免重複提取
                        const sourceNodeIdForRecord = sourceNode?.id ?? sourceNode?._meta?.id ?? sourceNodeId;
                        if (sourceNodeIdForRecord !== undefined && sourceNodeIdForRecord !== null) {
                          textconcatenateInputNodes.add(sourceNodeIdForRecord);
                        }
                        // ✅ 調試日誌
                        if (process.env.NODE_ENV === 'development') {
                          const sourceNodeIdForLog = sourceNode?.id ?? sourceNode?._meta?.id ?? sourceNodeId;
                          console.log(`✅ 從 textconcatenate 輸入節點提取文本: sourceNodeId=${sourceNodeIdForLog}, targetInputIndex=${targetInputIndex}, textLength=${extractedText.length}, textPreview=${extractedText.substring(0, 50)}...`);
                        }
                      } else {
                        if (process.env.NODE_ENV === 'development') {
                          console.warn(`⚠️ textconcatenate 輸入節點未提取到文本: sourceNodeId=${sourceNodeId}, targetInputIndex=${targetInputIndex}, sourceNodeType=${sourceNodeType}`);
                        }
                      }
                    } else {
                      if (process.env.NODE_ENV === 'development') {
                        console.log(`🔍 textconcatenate 鏈接目標輸入索引不匹配或不是文本節點: targetInputIndex=${targetInputIndex}, textCount=${textCount}, sourceNodeType=${sourceNodeType}, isTextNode=${isTextNode}`);
                      }
                    }
                  }
                }
              });
              
              // 按照 textconcatenate 的分隔符拼接
              if (concatenateTextParts.length > 0) {
                const concatenatedText = concatenateTextParts.join(delimiter);
                textParts.push(concatenatedText);
                // ✅ 調試日誌
                if (process.env.NODE_ENV === 'development') {
                  console.log(`✅ textconcatenate 節點拼接結果: delimiter="${delimiter}", partsCount=${concatenateTextParts.length}, textLength=${concatenatedText.length}, textPreview=${concatenatedText.substring(0, 100)}...`);
                }
              }
            } else {
              // 普通節點：直接提取文本
              // ✅ 注意：textconcatenate 節點不應該在這裡處理，應該在上面已經處理了
              if (textNodeType.includes("textconcatenate") || textNodeType.includes("concatenate")) {
                // 如果還是 textconcatenate，跳過（應該已經在上面處理了）
                if (process.env.NODE_ENV === 'development') {
                  const textNodeId = textNode?.id ?? textNode?._meta?.id ?? textNodeId;
                  console.warn(`⚠️ textconcatenate 節點進入了普通節點處理分支，這不應該發生: nodeId=${textNodeId}`);
                }
              } else {
                const textNodePrompt = extractPrompt(textNode);
                if (textNodePrompt?.text) {
                  textParts.push(textNodePrompt.text);
                } else {
                // 嘗試直接從 widgets_values 提取
                const widgets = textNode?.widgets_values;
                if (Array.isArray(widgets)) {
                  for (const widget of widgets) {
                    if (typeof widget === "string" && widget.length > 10) {
                      // 簡單檢查：排除明顯不是提示詞的內容
                      const widgetLower = widget.toLowerCase();
                      const isNotPrompt = widgetLower.includes(".safetensors") || 
                                         widgetLower.includes(".ckpt") || 
                                         widgetLower.includes(".pt") ||
                                         /^\d+$/.test(widget.trim()) ||
                                         widget.length > 2000;
                      if (!isNotPrompt) {
                        textParts.push(widget);
                        break;
                      }
                    }
                  }
                }
                // 嘗試從 value 字段提取（PrimitiveString 節點）
                if (textParts.length === 0) {
                  const value = textNode?.widgets_values?.[0] || textNode?.inputs?.value;
                  if (typeof value === "string" && value.length > 10) {
                    // 簡單檢查：排除明顯不是提示詞的內容
                    const valueLower = value.toLowerCase();
                    const isNotPrompt = valueLower.includes(".safetensors") || 
                                       valueLower.includes(".ckpt") || 
                                       valueLower.includes(".pt") ||
                                       /^\d+$/.test(value.trim()) ||
                                       value.length > 2000;
                    if (!isNotPrompt) {
                      textParts.push(value);
                    }
                  }
                }
              }
              }
            }
          }
        }
        
        if (textParts.length > 0) {
          // 合併所有文本部分
          finalPromptText = textParts.join(" ");
          // ✅ 調試日誌
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 從連接的文本節點提取提示詞: textEncodeNodeId=${nodeId}, textNodes=${connectedTextNodes.length}, textLength=${finalPromptText.length}, textPreview=${finalPromptText.substring(0, 50)}...`);
          }
        }
      }
    }
    
    if (finalPromptText) {
      // ✅ 優先使用連接關係判斷（最準確）
      // 如果連接關係明確，直接使用連接關係，忽略內容判斷
      if (connectionType === "negative") {
        found.negativePrompts.push(finalPromptText);
        // ✅ 調試日誌
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ 找到負面提示詞 (連接關係): nodeId=${nodeId}, textLength=${finalPromptText.length}, textPreview=${finalPromptText.substring(0, 50)}...`);
        }
      } else if (connectionType === "positive") {
        found.positivePrompts.push(finalPromptText);
        // ✅ 調試日誌
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ 找到正面提示詞 (連接關係): nodeId=${nodeId}, textLength=${finalPromptText.length}, textPreview=${finalPromptText.substring(0, 50)}...`);
        }
      } else {
        // ✅ 如果沒有連接關係（prompt chunk 通常沒有 links），使用 extractPrompt 返回的 isNegative 判斷
        // 這是 prompt chunk 的主要判斷方式
        if (prompt?.isNegative) {
          found.negativePrompts.push(finalPromptText);
          // ✅ 調試日誌
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 找到負面提示詞 (內容判斷): nodeId=${nodeId}, textLength=${finalPromptText.length}, textPreview=${finalPromptText.substring(0, 50)}...`);
          }
        } else {
          // ✅ 默認為正面提示詞（如果沒有明確標記為負面）
          found.positivePrompts.push(finalPromptText);
          // ✅ 調試日誌
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 找到正面提示詞 (內容判斷/默認): nodeId=${nodeId}, textLength=${finalPromptText.length}, textPreview=${finalPromptText.substring(0, 50)}...`);
          }
        }
      }
    } else {
      // ✅ 調試日誌：如果 extractPrompt 沒找到，但連接關係存在，記錄一下
      if (connectionType && process.env.NODE_ENV === 'development') {
        const nodeTypeStr = nodeType(n);
        const nodeLabel = n?._meta?.title || n?.name || n?.label || "";
        console.warn(`⚠️ 連接關係存在但未提取到提示詞: nodeId=${nodeId}, connectionType=${connectionType}, nodeType=${nodeTypeStr}, label=${nodeLabel}`);
        // ✅ 詳細調試：顯示節點的所有可能包含提示詞的字段
        console.log(`🔍 節點 ${nodeId} 的詳細信息:`, {
          inputs: n?.inputs,
          widgets_values: n?.widgets_values,
          properties: n?.properties,
          class_type: n?.class_type,
          type: n?.type,
        });
      }
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
          "widgets_values.2", // ✅ 擴展：檢查更多 widget 索引
          "widgets_values.3",
        ]);
      }
      
      // ✅ 改進：如果還是沒有找到，嘗試從 widgets_values 數組中查找第一個長字符串
      if (!directText && Array.isArray(n?.widgets_values)) {
        for (let i = 0; i < n.widgets_values.length; i++) {
          const widget = n.widgets_values[i];
          if (typeof widget === "string" && widget.length > 10) {
            // 使用統一的過濾函數檢查
            const isNotPromptTextLocal = (str) => {
              if (!str || typeof str !== "string") return true;
              const s = str.trim();
              if (s.length === 0) return true;
              const sLower = s.toLowerCase();
              
              // ✅ 優先檢查：純數字（很可能是 seed 或其他參數值）
              if (/^\d+$/.test(s)) {
                // 如果整個字符串都是數字，很可能是參數值（seed、steps、CFG 等）
                if (s.length > 10) {
                  return true; // 很可能是 seed 值
                }
                const numValue = parseInt(s, 10);
                // 如果數字在常見參數範圍內，也很可能是參數值
                if (numValue >= 0 && numValue <= 1000 && s.length <= 4) {
                  return true; // 很可能是參數值（steps、CFG 等）
                }
                // 如果數字很大，也很可能是 seed
                if (numValue > 1000 && s.length <= 15) {
                  return true; // 很可能是 seed 值
                }
              }
              
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
              
              // 檢查工作流說明關鍵詞
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
              
              // 檢查列表格式
              const listPattern = /^\d+[\.\)]\s+[^\n]{1,50}(\n\d+[\.\)]\s+[^\n]{1,50}){2,}/;
              if (listPattern.test(s)) {
                return true;
              }
              
              // 檢查過長文本（可能是說明文檔）
              if (s.length > 2000) {
                if (docKeywords.some(keyword => s.includes(keyword)) || /^\d+[\.\)]\s/.test(s)) {
                  return true;
                }
              }
              
              return false;
            };
            
            if (!isNotPromptTextLocal(widget)) {
              directText = widget;
              break;
            }
          }
        }
      }
      
      // ✅ 排除 SaveImage 等節點的 filename_prefix 和其他非提示詞字段
      const nodeTypeForExclusion = lower(n?.type || n?.class_type || "");
      if (nodeTypeForExclusion.includes("saveimage") || 
          nodeTypeForExclusion.includes("loadimage") ||
          nodeTypeForExclusion.includes("previewimage") ||
          nodeTypeForExclusion.includes("emptyimage") ||
          nodeTypeForExclusion.includes("textconcatenate") ||
          nodeTypeForExclusion.includes("concatenate")) {
        // 這些節點不應該被提取為提示詞
        // textconcatenate 節點的文本應該從它的輸入節點中提取，而不是直接提取
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
          
          // ✅ 優先檢查：純數字（很可能是 seed 或其他參數值）
          if (/^\d+$/.test(s)) {
            // 如果整個字符串都是數字，很可能是參數值（seed、steps、CFG 等）
            if (s.length > 10) {
              return true; // 很可能是 seed 值
            }
            const numValue = parseInt(s, 10);
            // 如果數字在常見參數範圍內，也很可能是參數值
            if (numValue >= 0 && numValue <= 1000 && s.length <= 4) {
              return true; // 很可能是參數值（steps、CFG 等）
            }
            // 如果數字很大，也很可能是 seed
            if (numValue > 1000 && s.length <= 15) {
              return true; // 很可能是 seed 值
            }
          }
          
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
            // ✅ 調試日誌
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ 找到負面提示詞 (直接提取+連接關係): nodeId=${nodeId}, textLength=${directText.trim().length}, textPreview=${directText.trim().substring(0, 50)}...`);
            }
          } else if (connectionType === "positive") {
            found.positivePrompts.push(directText.trim());
            // ✅ 調試日誌
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ 找到正面提示詞 (直接提取+連接關係): nodeId=${nodeId}, textLength=${directText.trim().length}, textPreview=${directText.trim().substring(0, 50)}...`);
            }
          } else {
            // 如果沒有連接關係，使用原有的判斷邏輯（但這應該很少發生）
            if (isNegative) {
              found.negativePrompts.push(directText.trim());
              // ✅ 調試日誌
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ 找到負面提示詞 (直接提取+內容判斷): nodeId=${nodeId}, textLength=${directText.trim().length}, textPreview=${directText.trim().substring(0, 50)}...`);
              }
            } else {
              found.positivePrompts.push(directText.trim());
              // ✅ 調試日誌
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ 找到正面提示詞 (直接提取+內容判斷): nodeId=${nodeId}, textLength=${directText.trim().length}, textPreview=${directText.trim().substring(0, 50)}...`);
              }
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

  // ✅ 調試日誌：記錄解析結果（僅在開發環境）
  if (process.env.NODE_ENV === 'development') {
    const connectionDetails = Array.from(promptNodeConnection.entries()).map(([nodeId, type]) => ({
      nodeId,
      type,
    }));
    
    console.log("🔍 ComfyUI 提示詞解析結果:", {
      positiveCount: found.positivePrompts.length,
      negativeCount: found.negativePrompts.length,
      positiveLength: out.canonical.positive?.length || 0,
      negativeLength: out.canonical.negative?.length || 0,
      connectionMapSize: promptNodeConnection.size,
      connectionDetails,
      kSamplerCount: kSamplerNodes.size,
      linksCount: links.length,
      promptConnectionsCount: promptConnections.length,
      promptConnections: promptConnections.map(c => ({
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        targetInputIndex: c.targetInputIndex,
        sourceLabel: c.sourceLabel,
        connectionType: promptNodeConnection.get(c.sourceNodeId),
      })),
    });
  }

  return out;
}

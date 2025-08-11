// utils/parseMeta.js
// 解析 Stable Diffusion / ComfyUI 圖片的生成參數。
// 用法（前端）：const meta = await extractMetaFromFile(file);

let pako = null;
try {
  // optional：沒有也能跑，只是遇到壓縮的 iTXt/zTXt 會跳過
  pako = require("pako");
} catch {}

const td = new TextDecoder("utf-8");
const tdLatin1 = new TextDecoder("latin1");

/** 主要入口：從 File/Blob(原檔PNG) 解析出欄位 */
export async function extractMetaFromFile(fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer().catch(() => null);
  if (!buf) return {};
  const chunks = readPngTextChunks(buf);

  // 1) A1111 parameters（最常見）
  const params =
    chunks["parameters"] ||
    chunks["Parameters"] ||
    chunks["Comment"] ||
    chunks["Description"];

  if (params) {
    return normalizeA1111(parseA1111Parameters(params));
  }

  // 2) sd-metadata（A1111 新版或其它前端）
  const sd = tryParseJson(
    chunks["sd-metadata"] || chunks["sd_metadata"] || chunks["SD:metadata"]
  );
  if (sd && typeof sd === "object") {
    return normalizeGeneric(sd);
  }

  // 3) ComfyUI：常見 keyword：workflow / prompt / comfy
  const comfy =
    tryParseJson(chunks["workflow"]) ||
    tryParseJson(chunks["prompt"]) ||
    tryParseJson(chunks["comfy"]) ||
    tryParseJson(chunks["ComfyUI"]);

  if (comfy && typeof comfy === "object") {
    return normalizeComfy(comfy);
  }

  return {};
}

/** 讀取 PNG 內所有 tEXt / iTXt / zTXt 的 key → value */
export function readPngTextChunks(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const u8 = new Uint8Array(arrayBuffer);

  // PNG magic
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) return {};

  let offset = 8;
  const out = {};

  while (offset + 8 <= u8.length) {
    const length = view.getUint32(offset); // big-endian
    const type =
      String.fromCharCode(
        u8[offset + 4],
        u8[offset + 5],
        u8[offset + 6],
        u8[offset + 7]
      ) || "";
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > u8.length) break; // CRC 出界，結束
    const data = u8.slice(dataStart, dataEnd);

    if (type === "tEXt") {
      // keyword\0text (latin-1)
      const zero = data.indexOf(0);
      if (zero > 0) {
        const key = tdLatin1.decode(data.slice(0, zero)).trim();
        const text = tdLatin1.decode(data.slice(zero + 1));
        if (key) out[key] = text;
      }
    } else if (type === "iTXt") {
      // keyword\0compressFlag\0compressMethod\0lang\0translated\0text
      // 參考規格：若 compressFlag=1，text 為 zlib
      let p = 0;
      const readZ = () => {
        const z = data.indexOf(0, p);
        const slice = data.slice(p, z < 0 ? data.length : z);
        p = z < 0 ? data.length : z + 1;
        return slice;
      };
      const key = td.decode(readZ()).trim();
      const compFlag = (data[p++] ?? 0) === 1;
      const compMethod = data[p++] ?? 0; // 0=zlib
      readZ(); // lang
      readZ(); // translated
      const rest = data.slice(p);

      let text = "";
      try {
        if (compFlag && compMethod === 0 && pako) {
          text = td.decode(pako.inflate(rest));
        } else {
          text = td.decode(rest);
        }
      } catch {
        /* ignore */
      }
      if (key) out[key] = text;
    } else if (type === "zTXt") {
      // keyword\0compMethod(=0) compressedText
      const zero = data.indexOf(0);
      if (zero > 0) {
        const key = tdLatin1.decode(data.slice(0, zero)).trim();
        const compMethod = data[zero + 1];
        const comp = data.slice(zero + 2);
        let text = "";
        try {
          if (compMethod === 0 && pako) text = td.decode(pako.inflate(comp));
        } catch {
          /* ignore */
        }
        if (key && text) out[key] = text;
      }
    }

    // IEND → 結束
    if (type === "IEND") break;
    offset = dataEnd + 4; // 跳過 CRC
  }
  return out;
}

/** 解析 A1111 的 parameters 文本 */
export function parseA1111Parameters(raw) {
  if (!raw || typeof raw !== "string") return {};
  const lines = raw.split(/\r?\n/).map((s) => s.trim());

  const idxNeg = lines.findIndex((l) =>
    /^negative prompt\s*:/i.test(l) || /^Negative prompt\s*:/i.test(l)
  );

  let positivePrompt = "";
  let negativePrompt = "";
  let cfg = {};
  if (idxNeg >= 0) {
    positivePrompt = lines.slice(0, idxNeg).join(" ").trim();
    negativePrompt = lines[idxNeg].replace(/^negative prompt\s*:/i, "").replace(/^Negative prompt\s*:/i, "").trim();
    cfg = parseKVs(lines.slice(idxNeg + 1).join(" "));
  } else {
    // 找不到 Negative prompt，就全當正向；下一行可能是 KVs
    positivePrompt = lines[0] || "";
    cfg = parseKVs(lines.slice(1).join(" "));
  }

  return {
    positivePrompt,
    negativePrompt,
    ...cfg,
  };
}

/** 解析 key-value 列（以逗號分隔的「鍵: 值」） */
function parseKVs(s) {
  const out = {};
  if (!s) return out;

  // 先依逗號切，但保留括號/引號內的逗號（簡化處理）
  const parts = s.split(/,(?=(?:[^()"]|\([^()"]*\)|"[^"]*")*$)/).map((x) => x.trim());

  for (const part of parts) {
    const m = part.match(/^\s*([^:]+):\s*(.+)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();

    switch (key.toLowerCase()) {
      case "steps":
        out.steps = toNum(val);
        break;
      case "sampler":
      case "sampler name":
        out.sampler = val;
        break;
      case "cfg scale":
      case "cfg":
        out.cfgScale = toNum(val);
        break;
      case "seed":
        out.seed = String(val);
        break;
      case "size": {
        const m2 = val.match(/(\d+)\s*[x×]\s*(\d+)/i);
        if (m2) {
          out.width = toNum(m2[1]);
          out.height = toNum(m2[2]);
        }
        break;
      }
      case "model":
      case "model name":
        out.modelName = val;
        break;
      case "model hash":
      case "hash":
        out.modelHash = val;
        break;
      case "clip skip":
      case "clipskip":
        out.clipSkip = toNum(val);
        break;
      default:
        // 其他像 Hires upscaler/denoising… 可視需要加
        break;
    }
  }

  return out;
}

function toNum(v) {
  const n = Number(String(v).replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function tryParseJson(s) {
  if (!s || typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 轉成你 DB 欄位名稱（通用 JSON 來源） */
function normalizeGeneric(obj = {}) {
  const out = {};
  // 嘗試多種常見 key
  out.positivePrompt = obj.prompt || obj.Prompt || obj.positivePrompt || "";
  out.negativePrompt =
    obj.negative_prompt || obj.NegativePrompt || obj.negativePrompt || "";

  out.steps = toNum(obj.steps ?? obj.Steps);
  out.sampler = obj.sampler ?? obj.Sampler;
  out.cfgScale = toNum(obj.cfg_scale ?? obj.cfgScale ?? obj.CFG);
  out.seed = obj.seed != null ? String(obj.seed) : undefined;
  out.width = toNum(obj.width);
  out.height = toNum(obj.height);
  out.modelName = obj.model ?? obj.Model ?? obj.modelName;
  out.modelHash = obj.model_hash ?? obj.ModelHash ?? obj.modelHash;
  out.clipSkip = toNum(obj.clip_skip ?? obj.clipSkip);

  return removeUndef(out);
}

/** 轉 ComfyUI 常見欄位 */
function normalizeComfy(json) {
  // Comfy 的結構很多變，這裡挑一些常見位置
  const out = {};

  // 1) workflow 類（新）
  if (json?.workflow && typeof json.workflow === "object") {
    const wf = json.workflow;
    out.seed = wf.seed != null ? String(wf.seed) : out.seed;
    out.steps = toNum(wf.steps ?? out.steps);
    out.sampler = wf.sampler ?? out.sampler;
    out.cfgScale = toNum(wf.cfg ?? wf.cfg_scale ?? out.cfgScale);
    out.modelName = wf.model ?? out.modelName;
  }

  // 2) prompt 類（舊）
  if (json?.prompt && typeof json.prompt === "object") {
    const p = json.prompt;
    // 這裡很依節點命名，你可以再按你的 workflow 做客製映射
    // 嘗試在樹裡找 seed/steps/cfg/sampler
    const flat = JSON.stringify(p);
    const mm = flat.match(/"seed"\s*:\s*("?)(\d+)\1/);
    if (mm) out.seed = String(mm[2]);

    const msteps = flat.match(/"steps"\s*:\s*(\d+)/);
    if (msteps) out.steps = toNum(msteps[1]);

    const mcfg = flat.match(/"cfg(?:_scale)?"\s*:\s*([\d.]+)/i);
    if (mcfg) out.cfgScale = toNum(mcfg[1]);

    const msampler = flat.match(/"sampler"\s*:\s*"([^"]+)"/i);
    if (msampler) out.sampler = msampler[1];
  }

  return removeUndef(out);
}

/** 轉 A1111 結果到你的 DB 欄位 */
function normalizeA1111(obj) {
  const out = {
    positivePrompt: obj.positivePrompt || "",
    negativePrompt: obj.negativePrompt || "",
    steps: toNum(obj.steps),
    sampler: obj.sampler,
    cfgScale: toNum(obj.cfgScale),
    seed: obj.seed != null ? String(obj.seed) : undefined,
    width: toNum(obj.width),
    height: toNum(obj.height),
    modelName: obj.modelName,
    modelHash: obj.modelHash,
    clipSkip: toNum(obj.clipSkip),
  };
  return removeUndef(out);
}

function removeUndef(o) {
  const x = { ...o };
  Object.keys(x).forEach((k) => x[k] === undefined && delete x[k]);
  return x;
}

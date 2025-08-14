// utils/parseMeta.js
// 解析 Stable Diffusion / ComfyUI 圖片的生成參數 + 確保拿到真實寬高
// 用法（前端）：const meta = await extractMetaFromFile(file);

let pako = null;
try { pako = require("pako"); } catch { /* pako 可選，沒裝就跳過壓縮解碼 */ }

const td = new TextDecoder("utf-8");
const tdLatin1 = new TextDecoder("latin1");

/**
 * 主要入口：從 File/Blob 解析出欄位（寬高一定盡力補上）
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<Object>}
 */
export async function extractMetaFromFile(fileOrBlob) {
  const buf = await fileOrBlob.arrayBuffer().catch(() => null);
  if (!buf) return {};

  // 讀 PNG 內文字區塊
  const chunks = readPngTextChunks(buf);

  // A) 先從 metadata 抓（A1111 / 通用 JSON / Comfy）
  const params =
    chunks["parameters"] || chunks["Parameters"] || chunks["Comment"] || chunks["Description"];
  let out = {};
  if (params) {
    // A1111 文字欄
    out = normalizeA1111(parseA1111Parameters(params));
  } else {
    // 通用 json 欄位
    const sd =
      tryParseJson(chunks["sd-metadata"] || chunks["sd_metadata"] || chunks["SD:metadata"]);
    if (sd && typeof sd === "object") {
      out = normalizeGeneric(sd);
    } else {
      // ComfyUI 常見欄位
      const comfy =
        tryParseJson(chunks["workflow"]) ||
        tryParseJson(chunks["prompt"]) ||
        tryParseJson(chunks["comfy"]) ||
        tryParseJson(chunks["ComfyUI"]);
      if (comfy && typeof comfy === "object") {
        out = normalizeComfy(comfy);
      }
    }
  }

  // B) 兜底：若缺 width/height，直接讀檔案像素
  if (!out.width || !out.height) {
    const pngSize = readPngSize(buf); // 若是 PNG，直接看 IHDR
    if (pngSize?.width && pngSize?.height) {
      out.width = pngSize.width;
      out.height = pngSize.height;
    } else if (typeof window !== "undefined") {
      // 不是 PNG 或讀取失敗 → 用瀏覽器解一次
      try {
        const s = await getImageSizeFromBlob(fileOrBlob);
        if (s.width && s.height) {
          out.width = s.width;
          out.height = s.height;
        }
      } catch {}
    }
  }

  return removeUndef(out);
}

/**
 * 讀取 PNG 內所有 tEXt / iTXt / zTXt 的 key → value
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Record<string,string>}
 */
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
      String.fromCharCode(u8[offset + 4], u8[offset + 5], u8[offset + 6], u8[offset + 7]) || "";
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > u8.length) break;

    const data = u8.slice(dataStart, dataEnd);

    if (type === "tEXt") {
      const zero = data.indexOf(0);
      if (zero > 0) {
        const key = tdLatin1.decode(data.slice(0, zero)).trim();
        const text = tdLatin1.decode(data.slice(zero + 1));
        if (key) out[key] = text;
      }
    } else if (type === "iTXt") {
      let p = 0;
      const readZ = () => {
        const z = data.indexOf(0, p);
        const slice = data.slice(p, z < 0 ? data.length : z);
        p = z < 0 ? data.length : z + 1;
        return slice;
      };
      const key = td.decode(readZ()).trim();
      const compFlag = (data[p++] ?? 0) === 1;
      const compMethod = data[p++] ?? 0;
      readZ(); // language tag
      readZ(); // translated keyword
      const rest = data.slice(p);
      let text = "";
      try {
        if (compFlag && compMethod === 0 && pako) text = td.decode(pako.inflate(rest));
        else text = td.decode(rest);
      } catch {}
      if (key) out[key] = text;
    } else if (type === "zTXt") {
      const zero = data.indexOf(0);
      if (zero > 0) {
        const key = tdLatin1.decode(data.slice(0, zero)).trim();
        const compMethod = data[zero + 1];
        const comp = data.slice(zero + 2);
        let text = "";
        try {
          if (compMethod === 0 && pako) text = td.decode(pako.inflate(comp));
        } catch {}
        if (key && text) out[key] = text;
      }
    }

    if (type === "IEND") break;
    offset = dataEnd + 4; // skip CRC
  }
  return out;
}

/**
 * 讀 PNG 的 IHDR 實際像素尺寸（讀不到就回 null）
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{width:number,height:number}|null}
 */
function readPngSize(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const u8 = new Uint8Array(arrayBuffer);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) return null;
  // 第一個 chunk 應為 IHDR，長度 13
  const type =
    String.fromCharCode(u8[12], u8[13], u8[14], u8[15]) || "";
  if (type !== "IHDR") return null;
  const width = view.getUint32(16);  // 8(sig)+4(len)+4(type) = 16
  const height = view.getUint32(20);
  if (!width || !height) return null;
  return { width, height };
}

/**
 * 用瀏覽器 Image 解 Blob 拿 naturalWidth/Height（適用 JPG/WEBP/AVIF…）
 * @param {Blob} blob
 * @returns {Promise<{width:number,height:number}>}
 */
async function getImageSizeFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    return { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* --------------------------- 下面是解析/正規化 --------------------------- */

/**
 * 解析 A1111 的文字參數塊
 * 常見格式：
 *   <prompt>
 *   Negative prompt: <neg>
 *   Steps: 28, Sampler: DPM++ 2M Karras, CFG scale: 6, Seed: 12345, Size: 640x832, Model: xxx
 * @param {string} raw
 * @returns {Record<string,any>}
 */
export function parseA1111Parameters(raw = "") {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  let prompt = "";
  let negative = "";
  let kvLine = "";

  // 兩種常見：1) 第一行是 prompt，第二行 Negative prompt:，第三行是 KV
  //          2) 只有一行大段（含 Negative prompt: 與 KVs）
  if (lines.length >= 2 && /negative prompt\s*:/i.test(lines[1])) {
    prompt = lines[0].trim();
    negative = lines[1].replace(/^\s*negative prompt\s*:\s*/i, "").trim();
    kvLine = (lines.slice(2).join(", ") || "").trim();
  } else if (/negative prompt\s*:/i.test(text)) {
    const [p, rest] = text.split(/negative prompt\s*:/i);
    prompt = (p || "").trim();
    const idx = rest.indexOf("\n");
    if (idx >= 0) {
      negative = rest.slice(0, idx).trim();
      kvLine = rest.slice(idx + 1).trim();
    } else {
      negative = rest.trim();
      kvLine = "";
    }
  } else {
    // 沒有 Negative prompt 標記，最後一行多半就是 KVs
    prompt = lines[0]?.trim() || "";
    kvLine = (lines.slice(1).join(", ") || "").trim();
  }

  const kvs = parseKVs(kvLine);

  // 特例：Size / Hires upscale / Hires upscaler 等
  const size = kvs["Size"] || kvs["size"];
  const { width, height } = parseSizeStr(size);

  const seed = toNum(kvs["Seed"] ?? kvs["seed"]);
  const steps = toNum(kvs["Steps"] ?? kvs["steps"]);
  const cfg_scale = toNum(
    kvs["CFG scale"] ?? kvs["CFG Scale"] ?? kvs["cfg scale"] ?? kvs["Guidance Scale"]
  );
  const sampler = kvs["Sampler"] ?? kvs["sampler"] ?? kvs["Sampler Name"];
  const model =
    kvs["Model"] ?? kvs["model"] ?? kvs["Model hash"] ?? kvs["Model Hash"] ?? kvs["ModelName"];

  return removeUndef({
    prompt,
    negative_prompt: negative,
    width,
    height,
    steps,
    cfg_scale,
    sampler,
    seed,
    model,
    raw: raw,
  });
}

/**
 * 把逗號分隔的 KVs 轉成物件（容忍「key: value, key2: value2」）
 * @param {string} s
 */
function parseKVs(s = "") {
  const out = {};
  if (!s) return out;
  // 以逗號為主切，避免 sampler 名稱裡有逗號的情況（罕見），這裡做個最簡耐錯
  const parts = s.split(/,(?![^()]*\))/g);
  for (let part of parts) {
    const m = part.split(":");
    if (m.length >= 2) {
      const key = m.shift().trim();
      const value = m.join(":").trim();
      if (key) out[key] = value;
    }
  }
  return out;
}

function parseSizeStr(s) {
  if (!s || typeof s !== "string") return { width: undefined, height: undefined };
  const m = s.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  return { width: undefined, height: undefined };
}

function toNum(v) {
  if (v === null || v === undefined) return undefined;
  const n = Number(String(v).trim());
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

/**
 * 正規化通用 JSON（例如 sd-webui png info 有時就是 JSON）
 */
function normalizeGeneric(obj = {}) {
  const out = { ...obj };

  // 常見映射
  if (out.Size && !out.width && !out.height) {
    const { width, height } = parseSizeStr(out.Size);
    out.width = out.width || width;
    out.height = out.height || height;
  }

  // 兼容 key 名
  out.negative_prompt = out.negative_prompt || out.negative || out["Negative prompt"];
  out.cfg_scale = out.cfg_scale ?? out.cfg ?? out.guidance_scale ?? out["CFG scale"];
  out.model = out.model || out.model_name || out.Model || out["Model hash"];

  return removeUndef(out);
}

/**
 * 正規化 ComfyUI 資訊（非常多樣，這裡抓幾個常見）
 */
function normalizeComfy(json = {}) {
  const out = {};

  // Comfy 的 prompt/workflow 裡，通常 width/height 藏在某個節點（如 KSampler, VAE Decode, Image Size）
  // 我們做淺掃：找任何具有 width/height 的節點值
  try {
    const obj = typeof json === "object" ? json : {};
    const scan = (v) => {
      if (!v) return;
      if (typeof v === "object") {
        if (Number.isFinite(v.width) && Number.isFinite(v.height)) {
          out.width = out.width || Number(v.width);
          out.height = out.height || Number(v.height);
        }
        for (const k in v) scan(v[k]);
      }
    };
    scan(obj);
  } catch {}

  // Comfy 沒有標準化的 prompt 欄位；有些 workflow 會在某處放 "positive"/"negative"
  out.prompt =
    json.prompt?.positive ||
    json.positive ||
    json.pos ||
    json.prompt ||
    json.text ||
    undefined;

  out.negative_prompt =
    json.prompt?.negative ||
    json.negative ||
    json.neg ||
    undefined;

  return removeUndef(out);
}

/**
 * 將 A1111 解析後的欄位再正規化一下
 */
function normalizeA1111(obj = {}) {
  const out = { ...obj };

  // 兼容 key 名
  out.cfg_scale = out.cfg_scale ?? out.cfg ?? out["CFG scale"] ?? out.guidance_scale;

  // 型別修正
  if (typeof out.width === "string") out.width = toNum(out.width);
  if (typeof out.height === "string") out.height = toNum(out.height);
  if (typeof out.steps === "string") out.steps = toNum(out.steps);
  if (typeof out.seed === "string") out.seed = toNum(out.seed);

  return removeUndef(out);
}

function removeUndef(o) {
  const out = {};
  for (const k in o) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") out[k] = o[k];
  }
  return out;
}

// 也給一個 default 匯出，方便以 import extractMetaFromFile from '...'
export default extractMetaFromFile;

// /app/api/images/[id]/edit/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";

// —— 小工具 ——

// 更寬鬆的真值判斷（支援 true/1/"1"/"true"/"yes"/"on"/"public"）
function truthy(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on" || s === "public";
  }
  return false;
}

function toNumOrNull(v) {
  if (v === "" || v === null || typeof v === "undefined") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTags(input) {
  const raw = Array.isArray(input) ? input.join(" ") : String(input || "");
  return raw
    .split(/[\s,，、]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

// 僅允許的可更新欄位（基礎層）
const allowedFields = [
  "title",
  "description",
  "category",
  "rating",
  "modelName",
  "modelUrl",     // 你前端送這個；若舊資料用 modelLink，後面會一併處理
  "loraName",
  "loraUrl",      // 同上（loraLink）
  "tags",

  // 進階參數
  "steps",
  "sampler",
  "cfgScale",
  "seed",
  "clipSkip",
  "width",
  "height",
  "modelHash",

  // ✅ 新增：前端 checkbox 對應欄位，會被轉寫進 comfy.allowShare
  "allowComfyShare",
];

export async function PATCH(req, ctx) {
  try {
    await dbConnect();

    // 取得並驗證參數
    const { id } = (await ctx.params) || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "無效的圖片 ID" }, { status: 400 });
    }

    // 權限：必須登入
    const currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: "請先登入" }, { status: 401 });
    }

    // 解析 body
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, message: "請提供 JSON 請求內容" }, { status: 400 });
    }

    // 取得圖片
    const image = await Image.findById(id).populate({ path: "user", select: "_id isAdmin currentFrame frameSettings" });
    if (!image) {
      return NextResponse.json({ ok: false, message: "找不到圖片" }, { status: 404 });
    }

    // 權限：作者或管理員
    const ownerId = image.user?._id || image.user || null;
    const isOwner = ownerId && String(ownerId) === String(currentUser._id);
    const isAdmin = !!currentUser?.isAdmin;
    if (!(isOwner || isAdmin)) {
      return NextResponse.json({ ok: false, message: "沒有權限編輯此圖片" }, { status: 403 });
    }

    // 建立更新物件（只挑允許欄位）
    const updates = {};
    for (const k of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates[k] = body[k];
      }
    }

    // 欄位型別處理
    if ("tags" in updates) {
      updates.tags = normalizeTags(updates.tags);
    }

    // 進階數值欄位
    if ("steps" in updates) updates.steps = toNumOrNull(updates.steps);
    if ("cfgScale" in updates) updates.cfgScale = toNumOrNull(updates.cfgScale);
    if ("clipSkip" in updates) updates.clipSkip = toNumOrNull(updates.clipSkip);
    if ("width" in updates) updates.width = toNumOrNull(updates.width);
    if ("height" in updates) updates.height = toNumOrNull(updates.height);
    if ("seed" in updates) updates.seed = String(updates.seed ?? ""); // 保持字串以便前端顯示

    // civitai 連結（若你後端舊欄位用 modelLink / loraLink，可一併寫入）
    if ("modelUrl" in updates) {
      image.modelUrl = updates.modelUrl || "";
      image.modelLink = updates.modelUrl || ""; // 舊欄位相容
      delete updates.modelUrl;
    }
    if ("loraUrl" in updates) {
      image.loraUrl = updates.loraUrl || "";
      image.loraLink = updates.loraUrl || ""; // 舊欄位相容
      delete updates.loraUrl;
    }

    // ✅ 核心：把 allowComfyShare 寫入 image.comfy.allowShare（布林）
    if ("allowComfyShare" in updates) {
      image.comfy = image.comfy || {};
      image.comfy.allowShare = truthy(updates.allowComfyShare);
      delete updates.allowComfyShare;
    }

    // 其餘欄位（基礎、進階）直接寫回
    const directKeys = [
      "title",
      "description",
      "category",
      "rating",
      "modelName",
      "loraName",
      "tags",
      "steps",
      "sampler",
      "cfgScale",
      "seed",
      "clipSkip",
      "width",
      "height",
      "modelHash",
    ];
    for (const k of directKeys) {
      if (k in updates) {
        image[k] = updates[k];
      }
    }

    await image.save();

    // 回傳最新資料（精簡版）
    const saved = await Image.findById(id)
      .populate({ path: "user", select: "_id username image isAdmin currentFrame frameSettings" })
      .lean();

    return NextResponse.json({ ok: true, image: saved });
  } catch (err) {
    console.error("❌ PATCH /api/images/[id]/edit 失敗：", err);
    return NextResponse.json({ ok: false, message: "更新失敗" }, { status: 500 });
  }
}

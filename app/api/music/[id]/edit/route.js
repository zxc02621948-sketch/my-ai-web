import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { computeMusicCompleteness } from "@/utils/scoreMusic";

// 工具函數
function normalizeTags(input) {
  const raw = Array.isArray(input) ? input.join(" ") : String(input || "");
  return raw
    .split(/[\s,，、]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toNumOrNull(v) {
  if (v === "" || v === null || typeof v === "undefined") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 允許的可更新欄位
const allowedFields = [
  "title",
  "description",
  "tags",
  "category",
  "rating",
  "platform",
  "prompt",
  "modelName",
  "modelLink",
  "genre",
  "language",
  "mood",
  "tempo",
  "key",
  "lyrics",
  "singerGender",
  "seed",
  "excludeStyles",
  "styleInfluence",
  "weirdness",
];

export async function PATCH(req, { params }) {
  try {
    await dbConnect();

    // 取得並驗證參數
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "無效的音樂 ID" },
        { status: 400 }
      );
    }

    // 權限：必須登入
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: "請先登入" },
        { status: 401 }
      );
    }

    // 解析 body
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "請提供 JSON 請求內容" },
        { status: 400 }
      );
    }

    // 取得音樂
    const music = await Music.findById(id);
    if (!music) {
      return NextResponse.json(
        { ok: false, message: "找不到音樂" },
        { status: 404 }
      );
    }

    // 權限：作者或管理員
    const isOwner = music.author.toString() === currentUser._id.toString();
    const isAdmin = !!currentUser?.isAdmin;
    if (!(isOwner || isAdmin)) {
      return NextResponse.json(
        { ok: false, message: "沒有權限編輯此音樂" },
        { status: 403 }
      );
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

    if ("genre" in updates && Array.isArray(updates.genre)) {
      updates.genre = updates.genre.filter((g) => g && g.trim());
    }

    // 數值欄位
    if ("tempo" in updates) updates.tempo = toNumOrNull(updates.tempo);
    if ("styleInfluence" in updates)
      updates.styleInfluence = toNumOrNull(updates.styleInfluence);
    if ("weirdness" in updates)
      updates.weirdness = toNumOrNull(updates.weirdness);

    // 字串欄位（trim 處理）
    const stringFields = [
      "title",
      "description",
      "category",
      "rating",
      "platform",
      "prompt",
      "modelName",
      "modelLink",
      "language",
      "mood",
      "key",
      "lyrics",
      "singerGender",
      "seed",
      "excludeStyles",
    ];
    for (const k of stringFields) {
      if (k in updates) {
        updates[k] = String(updates[k] || "").trim();
      }
    }

    // 更新音樂資料
    for (const k of allowedFields) {
      if (k in updates) {
        music[k] = updates[k];
      }
    }

    // 重新計算完整度（但不重算 popScore）
    music.completenessScore = computeMusicCompleteness(music);
    music.hasMetadata = music.completenessScore >= 30;

    // 確保 likesCount 同步（數據一致性）
    if (Array.isArray(music.likes)) {
      music.likesCount = music.likes.length;
    }

    // ❌ 不重算 popScore - 編輯元數據不應影響熱門度
    // popScore 只在互動時更新（點讚、點擊）

    await music.save();

    // 重新填充作者資訊
    await music.populate("author", "username avatar currentFrame frameSettings");

    // 回傳最新資料
    const saved = await Music.findById(id)
      .populate({
        path: "author",
        select: "_id username avatar currentFrame frameSettings",
      })
      .lean();

    return NextResponse.json({ ok: true, music: saved });
  } catch (err) {
    console.error("❌ PATCH /api/music/[id]/edit 失敗：", err);
    return NextResponse.json(
      { ok: false, message: "更新失敗" },
      { status: 500 }
    );
  }
}


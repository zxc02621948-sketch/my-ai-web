import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";

export async function PATCH(req, { params }) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ message: "未登入" }, { status: 401 });
    }

    const { id } = params || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "無效的圖片 ID" }, { status: 400 });
    }

    const image = await Image.findById(id);
    if (!image) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    // 權限：上傳者或管理員
    const isOwner = String(image.user) === String(currentUser._id);
    if (!isOwner && !currentUser.isAdmin) {
      return NextResponse.json({ message: "沒有權限編輯此圖片" }, { status: 403 });
    }

    const body = await req.json();

    // —— 白名單欄位（不包含 imageUrl 等檔案欄位）——
    const allowedFields = [
      "title",
      "description",
      "category",
      "rating",
      "modelName",
      "modelUrl",
      "loraName",
      "loraUrl",
      "tags",
      // ▼ 新增進階欄位
      "steps",
      "sampler",
      "cfgScale",
      "seed",
      "clipSkip",
      "width",
      "height",
      "modelHash",
    ];

    const updates = {};
    for (const k of allowedFields) {
      if (k in body) updates[k] = body[k];
    }

    // 分級檢查
    if (updates.rating && !["all", "15", "18"].includes(updates.rating)) {
      return NextResponse.json({ message: "非法的分級" }, { status: 400 });
    }

    // civitai 網址檢查：非空才檢查；空字串代表清除
    const isInvalidCivitai = (url) =>
      typeof url === "string" && url.trim() !== "" && !/^https?:\/\/(www\.)?civitai\.com\//i.test(url.trim());

    if (isInvalidCivitai(updates.modelUrl) || isInvalidCivitai(updates.loraUrl)) {
      return NextResponse.json(
        { message: "模型／LoRA 連結僅允許 civitai.com 網址" },
        { status: 400 }
      );
    }

    // tags 允許字串或陣列
    if ("tags" in updates) {
      if (Array.isArray(updates.tags)) {
        updates.tags = updates.tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof updates.tags === "string") {
        updates.tags = updates.tags
          .split(/[\s,，、]+/g)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (updates.tags == null) {
        updates.tags = [];
      } else {
        return NextResponse.json({ message: "tags 格式不正確" }, { status: 400 });
      }
    }

    // —— 舊欄位同步策略（含清空；不動 imageUrl）——
    if ("modelUrl" in updates) {
      const v = (updates.modelUrl || "").trim();
      image.modelUrl = v; // 你的 schema 若無此欄位可刪掉
      image.modelLink = v;
      image.modelCivitaiUrl = v;
      delete updates.modelUrl;
    }
    if ("loraUrl" in updates) {
      const v = (updates.loraUrl || "").trim();
      image.loraUrl = v; // 你的 schema 若無此欄位可刪掉
      image.loraLink = v;
      image.loraCivitaiUrl = v;
      delete updates.loraUrl;
    }

    // —— 進階欄位型別處理 ——
    if ("steps" in updates) updates.steps = updates.steps === "" ? null : Number(updates.steps);
    if ("cfgScale" in updates) updates.cfgScale = updates.cfgScale === "" ? null : Number(updates.cfgScale);
    if ("seed" in updates) updates.seed = String(updates.seed || "");
    if ("clipSkip" in updates) updates.clipSkip = updates.clipSkip === "" ? null : Number(updates.clipSkip);
    if ("width" in updates) updates.width = updates.width === "" ? null : Number(updates.width);
    if ("height" in updates) updates.height = updates.height === "" ? null : Number(updates.height);

    // 套用其餘更新
    Object.assign(image, updates);

    await image.save();

    // —— 回傳最新資料（簡化版，維持你原有 GET 正規化策略即可）——
    const doc = await Image.findById(id)
      .populate({ path: "user", select: "_id username image isAdmin level" })
      .lean();

    return NextResponse.json({ message: "圖片資料已更新", image: doc });
  } catch (error) {
    console.error("❌ 更新圖片資料錯誤：", error);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}

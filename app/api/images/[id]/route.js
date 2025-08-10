// app/api/images/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";

export async function GET(_req, ctx) {
  try {
    await dbConnect();

    // ⬅️ 這行是關鍵：params 需要 await
    const { id } = await ctx.params || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "無效的圖片 ID" }, { status: 400 });
    }

    const currentUser = await getCurrentUser(); // 可為 null

    const doc = await Image.findById(id)
      .populate({ path: "user", select: "_id username image isAdmin level" })
      .lean();

    if (!doc) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    // 18+ 需要登入；登入即可看
    if (doc.rating === "18" && !currentUser) {
      return NextResponse.json({ message: "請登入以查看 18+ 圖片" }, { status: 401 });
    }

    // —— 欄位正規化（舊欄位相容 + 嚴謹判斷 LoRA）——
    const isCivitai = (v) =>
      typeof v === "string" && /https?:\/\/(www\.)?civitai\.com\//i.test(v);
    const hasLoraHint = (k, v) => /lora/i.test(String(k) + " " + String(v));

    let modelUrl = doc.modelUrl || doc.modelLink || doc.modelCivitaiUrl || "";
    let loraUrl  = doc.loraUrl  || doc.loraLink  || doc.loraCivitaiUrl  || "";

    if (!modelUrl || !isCivitai(modelUrl)) {
      for (const [k, v] of Object.entries(doc)) {
        if (isCivitai(v) && !hasLoraHint(k, v)) { modelUrl = v; break; }
      }
    }
    if (!loraUrl || !isCivitai(loraUrl)) {
      for (const [k, v] of Object.entries(doc)) {
        if (isCivitai(v) && hasLoraHint(k, v)) { loraUrl = v; break; }
      }
    }

    const normalized = {
      ...doc,
      author: typeof doc.author === "string" ? doc.author : "",
      modelUrl: modelUrl && isCivitai(modelUrl) ? modelUrl : "",
      loraUrl:  loraUrl  && isCivitai(loraUrl)  ? loraUrl  : "",
    };

    const isOwner =
      !!currentUser && String(normalized.user?._id) === String(currentUser._id);
    const canEdit = !!currentUser && (isOwner || currentUser.isAdmin);

    return NextResponse.json({ image: normalized, isOwner, canEdit });
  } catch (err) {
    console.error("❌ 取得圖片資料錯誤：", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}

// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import ClickThrottle from "@/models/ClickThrottle";
import mongoose from "mongoose";
import { cookies } from "next/headers"; // <- 15+ 需 await
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function getUserIdFromRequest(_req) {
  // 如果你有 session，可在這裡解析；目前先回 null
  return null;
}

export async function POST(req, ctx) {
  // --- 1) 參數（要 await）---
  const { params } = ctx;
  const { id } = await params;

  // id 基礎檢查（先檢完再連 DB，省資源）
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { ok: false, message: "Invalid image id" },
      { status: 400 }
    );
  }

  try {
    // --- 2) 連 DB ---
    await dbConnect();

    // --- 3) 取得使用者識別（cookies 要 await）---
    const userId = await getUserIdFromRequest(req);
    const jar = await cookies();
    let cid = jar.get("cid")?.value;
    let needSetCid = false;
    if (!cid) {
      cid = randomUUID();
      needSetCid = true; // 最後用 NextResponse 設 cookie
    }
    const key = userId || cid;

    // 小工具：統一回傳並在需要時設置 cid
    const send = (body, init = {}) => {
      const res = NextResponse.json(body, init);
      if (needSetCid) {
        res.cookies.set("cid", cid, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 365, // 1 年
        });
      }
      return res;
    };

    // --- 4) 嘗試建立冷卻紀錄（30s TTL，模型上應有 unique(imageId,key) + TTL index）---
    try {
      await ClickThrottle.create({ imageId: new mongoose.Types.ObjectId(id), key });
    } catch (e) {
      // 命中 unique => 冷卻中，不加計
      if (e?.code === 11000) {
        const img = await Image.findById(id).lean();
        const clicks =
          typeof img?.clicks === "number"
            ? img.clicks
            : Array.isArray(img?.clicks)
            ? img.clicks.length
            : Number(img?.clicks) || 0;

        return send({ ok: true, throttled: true, clicks });
      }
      throw e;
    }

    // --- 5) 冷卻未命中 => 點擊 +1 ---
    const updated = await Image.findByIdAndUpdate(
      id,
      { $inc: { clicks: 1 } },
      { new: true, upsert: false, lean: true }
    );
    if (!updated) {
      return send({ ok: false, message: "Image not found" }, { status: 404 });
    }

    const clicks =
      typeof updated.clicks === "number"
        ? updated.clicks
        : Array.isArray(updated.clicks)
        ? updated.clicks.length
        : Number(updated.clicks) || 0;

    return send({ ok: true, throttled: false, clicks });
  } catch (err) {
    console.error("click API error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

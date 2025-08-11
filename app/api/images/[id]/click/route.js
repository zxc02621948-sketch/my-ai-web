// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import ClickThrottle from "@/models/ClickThrottle";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

async function getUserIdFromRequest(req) {
  try {
    // 如果你有 session，可在這裡解析；目前先回 null
    return null;
  } catch {
    return null;
  }
}

export async function POST(req, { params }) {
  try {
    await dbConnect();
    const { id } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "Invalid image id" }, { status: 400 });
    }

    // 1) 取得使用者識別：userId or 裝置 cookie（cid）
    const userId = await getUserIdFromRequest(req);
    const jar = cookies();
    let cid = jar.get("cid")?.value;
    if (!cid) {
      cid = randomUUID();
      // 發一個一年有效的裝置 ID
      jar.set("cid", cid, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    const key = userId || cid;

    // 2) 嘗試建立冷卻紀錄（30 秒 TTL）
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

        return NextResponse.json({ ok: true, throttled: true, clicks });
      }
      throw e;
    }

    // 3) 冷卻未命中 => 點擊 +1
    const updated = await Image.findByIdAndUpdate(
      id,
      { $inc: { clicks: 1 } },
      { new: true, upsert: false, lean: true }
    );

    if (!updated) {
      return NextResponse.json({ ok: false, message: "Image not found" }, { status: 404 });
    }

    const clicks =
      typeof updated.clicks === "number"
        ? updated.clicks
        : Array.isArray(updated.clicks)
        ? updated.clicks.length
        : Number(updated.clicks) || 0;

    return NextResponse.json({ ok: true, throttled: false, clicks });
  } catch (err) {
    console.error("click API error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

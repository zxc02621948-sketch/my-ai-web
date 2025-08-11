// app/api/admin/build-indexes/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

// 確保在 Vercel 上不被快取
export const dynamic = "force-dynamic";

/**
 * 安全性：用一個簡單的「管理密鑰」保護這支 API。
 * 部署時請在環境變數加入 ADMIN_SECRET=一串隨機字串
 * 呼叫時在 Header 帶上 x-admin-secret
 */

export async function POST(req) {
  try {
    const secret = process.env.ADMIN_SECRET;
    const provided = req.headers.get("x-admin-secret");

    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_SECRET 未設定（請在環境變數加上）" },
        { status: 500 }
      );
    }
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // 比較安全的作法：createIndexes() 只建立缺少的索引，不會刪掉 DB 既有索引
    // 若你需要「完全比對 schema、刪掉多餘索引」，可以改用 syncIndexes()
    const results = {};

    // 建立 Image 的索引
    await Image.createIndexes();
    results.Image = "createIndexes: done";

    return NextResponse.json({
      ok: true,
      message: "索引建立完成",
      results,
    });
  } catch (err) {
    console.error("❌ 建索引失敗:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "建索引失敗" },
      { status: 500 }
    );
  }
}

// 可選：GET 給你檢查路由是否存在（不做任何動作）
export async function GET() {
  return NextResponse.json({
    ok: true,
    tip: "請以 POST 呼叫並在 header 帶 x-admin-secret",
  });
}

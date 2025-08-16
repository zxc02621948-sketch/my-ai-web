import { NextResponse } from "next/server";

/**
 * Warm/health endpoint
 * - 回傳 200 + JSON，避免外部監測服務（cron-job.org）把 204 視為失敗
 * - 可選簡單 token 驗證：?t=...（沒有就照樣回 200，不擋 cron）
 * - 禁止快取，確保每次真的打到邊緣/函式
 */

const OK_BODY = () =>
  NextResponse.json(
    {
      ok: true,
      service: "aicreateaworld",
      endpoint: "warm",
      ts: Date.now(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );

export async function GET(req) {
  // 若你想強制驗證 token，就把下面這段的 if 打開（目前預設不擋）
  // const url = new URL(req.url);
  // const token = url.searchParams.get("t");
  // if (token !== "uS5p9Lz7") {
  //   return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });
  // }

  return OK_BODY();
}

// 部分監測服務會用 HEAD；同樣回 200
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

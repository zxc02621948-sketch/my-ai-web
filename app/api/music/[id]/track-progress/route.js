// app/api/music/[id]/track-progress/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";

export const dynamic = "force-dynamic";

// 內存緩存：追蹤哪些音樂已經計數過，防止短時間內重複計數
// 格式: { musicId: { counted: true, timestamp: number } }
const countedCache = new Map();

// 防護時間：1 分鐘內同一首音樂只能計數一次
const PROTECTION_WINDOW_MS = 60000; // 1 分鐘 = 60000 毫秒

// 清理過期的緩存
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of countedCache.entries()) {
    if (now - data.timestamp > PROTECTION_WINDOW_MS) {
      countedCache.delete(id);
    }
  }
}, 30000); // 每 30 秒清理一次過期緩存

export async function POST(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    const { progress, duration, startTime, playedDuration } = body;
    // progress: 當前播放位置（秒）
    // duration: 總時長（秒）
    // startTime: 開始播放時的位置（秒）
    // playedDuration: 實際播放的時長（秒）= progress - startTime

    if (!id) {
      return NextResponse.json({ error: "缺少音樂ID" }, { status: 400 });
    }

    const music = await Music.findById(id);
    if (!music) {
      return NextResponse.json({ error: "音樂不存在" }, { status: 404 });
    }

    // 檢查是否已經計數過
    const cacheKey = id.toString();
    const cached = countedCache.get(cacheKey);

    // 計算實際播放的百分比（優先使用 playedDuration，如果沒有則回退到舊邏輯）
    const actualPlayedDuration =
      playedDuration !== undefined
        ? playedDuration
        : Math.max(0, progress - (startTime || 0));
    const playedPercent =
      duration > 0 ? (actualPlayedDuration / duration) * 100 : 0;

    // ✅ 檢查緩存，並驗證時間戳是否在防護時間內
    if (cached && cached.counted) {
      const timeSinceCounted = Date.now() - cached.timestamp;
      if (timeSinceCounted < PROTECTION_WINDOW_MS) {
        // 在防護時間內，已計數過
        return NextResponse.json({
          success: true,
          playedPercent,
          counted: true,
          alreadyCounted: true,
        });
      } else {
        // 超過防護時間，清除過期緩存
        countedCache.delete(cacheKey);
      }
    }

    // 只有實際播放時長達到總時長的 10% 以上且尚未計數時才增加播放次數
    if (playedPercent >= 10) {
      // ✅ 優化：使用原子操作增加播放次數（避免並發問題）
      const updateResult = await Music.updateOne(
        { _id: id },
        { $inc: { plays: 1 } },
        { upsert: false },
      );

      // ✅ 優化：驗證更新是否成功
      if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
        return NextResponse.json(
          { error: "音樂不存在或更新失敗" },
          { status: 404 },
        );
      }

      // 記錄到緩存，避免重複計數
      countedCache.set(cacheKey, {
        counted: true,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        playedPercent,
        counted: true,
      });
    }

    return NextResponse.json({
      success: true,
      playedPercent,
      counted: false,
    });
  } catch (error) {
    console.error("追蹤播放進度失敗:", error);
    return NextResponse.json({ error: "追蹤失敗" }, { status: 500 });
  }
}

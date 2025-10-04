// app/api/user/[id]/stats/route.js
import { NextResponse } from "next/server";
import { calculateUserStats } from "@/utils/userStats";

// 明確標示為動態 Route，避免在開發模式下出現靜態推斷造成的警告
export const dynamic = "force-dynamic";

export async function GET(request, ctx) {
  try {
    const params = await ctx.params;
    const userId = params?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "用戶 ID 是必需的" },
        { status: 400 }
      );
    }

    // 計算用戶統計數據
    const stats = await calculateUserStats(userId);

    return NextResponse.json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error("獲取用戶統計數據時發生錯誤:", error);
    return NextResponse.json(
      { error: "服務器內部錯誤" },
      { status: 500 }
    );
  }
}
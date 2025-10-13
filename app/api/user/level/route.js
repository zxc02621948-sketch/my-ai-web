import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getLevelInfo } from "@/utils/pointsLevels";

export async function GET(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const points = currentUser.pointsBalance || 0;
    const levelInfo = getLevelInfo(points);

    return NextResponse.json({
      success: true,
      data: {
        points,
        level: levelInfo,
        user: {
          id: currentUser._id,
          username: currentUser.username,
          image: currentUser.image
        }
      }
    });

  } catch (error) {
    console.error("❌ 獲取等級信息失敗:", error);
    return NextResponse.json(
      { error: "獲取等級信息失敗" },
      { status: 500 }
    );
  }
}

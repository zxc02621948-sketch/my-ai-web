import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit")) || 10;
    const type = searchParams.get("type") || "points"; // points, level, etc.

    let sortField = {};
    let pipeline = [];

    if (type === "points") {
      sortField = { pointsBalance: -1 };
      pipeline = [
        { $match: { pointsBalance: { $exists: true, $gte: 0 } } },
        { $sort: { pointsBalance: -1 } },
        { $limit: limit },
        { 
          $project: {
            _id: 1,
            username: 1,
            avatar: 1,
            pointsBalance: 1,
            createdAt: 1
          }
        }
      ];
    }

    const users = await User.aggregate(pipeline);

    return NextResponse.json({
      success: true,
      data: users,
      meta: {
        total: users.length,
        limit,
        type
      }
    });

  } catch (error) {
    console.error("❌ 獲取排行榜失敗:", error);
    return NextResponse.json(
      { error: "獲取排行榜失敗" },
      { status: 500 }
    );
  }
}

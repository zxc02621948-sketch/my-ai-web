import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import User from "@/models/User";

const FRAME_COSTS = {
  "default": 0,
  "cat-ears": 0,
  "flame-ring": 0,
  "flower-wreath": 0,
  "ai-generated": 0,
  "animals": 0,
  "flowers": 0,
  "leaves": 0
};

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { frameId, cost } = await req.json();
    
    if (!frameId) {
      return NextResponse.json({ error: "請選擇頭像框" }, { status: 400 });
    }

    const expectedCost = FRAME_COSTS[frameId];
    if (expectedCost === undefined) {
      return NextResponse.json({ error: "無效的頭像框" }, { status: 400 });
    }

    if (cost !== expectedCost) {
      return NextResponse.json({ error: "價格不匹配" }, { status: 400 });
    }

    // 檢查積分是否足夠
    if (currentUser.pointsBalance < cost) {
      return NextResponse.json({ 
        error: `積分不足！需要 ${cost} 積分，你目前有 ${currentUser.pointsBalance} 積分` 
      }, { status: 400 });
    }

    // 檢查是否已擁有此頭像框
    const ownedFrames = currentUser.ownedFrames || [];
    if (ownedFrames.includes(frameId)) {
      return NextResponse.json({ 
        error: "你已經擁有這個頭像框了" 
      }, { status: 400 });
    }

    // 扣除積分並添加頭像框
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        $inc: { pointsBalance: -cost },
        $addToSet: { ownedFrames: frameId }
      },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      message: "頭像框購買成功！",
      data: {
        newBalance: updatedUser.pointsBalance,
        ownedFrames: updatedUser.ownedFrames
      }
    });

  } catch (error) {
    console.error("❌ 購買頭像框失敗:", error);
    return NextResponse.json(
      { error: "購買頭像框失敗" },
      { status: 500 }
    );
  }
}

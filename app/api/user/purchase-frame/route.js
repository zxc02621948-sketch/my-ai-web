import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";

const FRAME_COSTS = {
  "default": 0,
  "cat-ears": 0,
  "flame-ring": 0,
  "flower-wreath": 0,
  "ai-generated": 0,
  "animals": 0,
  "flowers": 0,
  "leaves": 0,
  "magic-circle": 0,
  "magic-circle-2": 0
};

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { frameId, cost } = await req.json();
    
    console.log("🔧 購買頭像框請求:", { frameId, cost, currentUser: currentUser._id });
    
    if (!frameId) {
      console.log("❌ 缺少 frameId");
      return NextResponse.json({ error: "請選擇頭像框" }, { status: 400 });
    }

    const expectedCost = FRAME_COSTS[frameId];
    console.log("🔧 價格檢查:", { frameId, cost, expectedCost, match: cost === expectedCost });
    
    if (expectedCost === undefined) {
      console.log("❌ 無效的頭像框:", frameId);
      return NextResponse.json({ error: "無效的頭像框" }, { status: 400 });
    }

    if (Number(cost) !== Number(expectedCost)) {
      console.log("❌ 價格不匹配:", { cost, expectedCost, costType: typeof cost, expectedType: typeof expectedCost });
      return NextResponse.json({ error: "價格不匹配" }, { status: 400 });
    }

    // 檢查是否已擁有此頭像框
    const ownedFrames = currentUser.ownedFrames || [];
    if (ownedFrames.includes(frameId)) {
      return NextResponse.json({ 
        error: "你已經擁有這個頭像框了" 
      }, { status: 400 });
    }

    // 所有頭像框都是免費的，直接添加
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
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

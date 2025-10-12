import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";

export async function GET() {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    // 返回用戶擁有的頭像框列表
    const ownedFrames = currentUser.ownedFrames || [];
    
    // console.log("🔧 getCurrentUser 返回的用戶數據:", currentUser);
    
    return NextResponse.json({ 
      success: true, 
      data: ownedFrames 
    });
    
  } catch (error) {
    console.error("獲取擁有的頭像框失敗:", error);
    return NextResponse.json({ 
      success: false, 
      message: "獲取失敗" 
    }, { status: 500 });
  }
}

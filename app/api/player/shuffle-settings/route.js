import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function PATCH(request) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    const { allowShuffle } = await request.json();
    const normalized = !!allowShuffle;

    await User.findByIdAndUpdate(currentUser._id, {
      playlistAllowShuffle: normalized,
    });

    return NextResponse.json({
      success: true,
      allowShuffle: normalized,
    });
  } catch (error) {
    console.error("更新隨機播放設定錯誤:", error);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}


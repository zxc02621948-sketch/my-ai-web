// app/api/user/save-playlist/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import { dbConnect } from "@/lib/db";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    const { playlist } = await req.json();
    
    if (!Array.isArray(playlist)) {
      return NextResponse.json({ success: false, message: "播放清單格式錯誤" }, { status: 400 });
    }

    // 驗證播放清單項目
    const isValid = playlist.every(item => 
      item && 
      typeof item.title === 'string' && 
      typeof item.url === 'string' &&
      item.url.trim().length > 0
    );

    if (!isValid) {
      return NextResponse.json({ success: false, message: "播放清單項目格式錯誤" }, { status: 400 });
    }

    // 更新用戶的播放清單
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    user.playlist = playlist;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "播放清單已保存",
      playlist: user.playlist
    });

  } catch (error) {
    console.error("❌ 保存播放清單錯誤:", error);
    console.error("❌ 錯誤詳情:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤",
      error: error.message
    }, { status: 500 });
  }
}


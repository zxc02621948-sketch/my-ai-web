// app/api/user/save-playlist/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import { dbConnect } from "@/lib/db";

export async function POST(req) {
  try {
    console.log("🔧 save-playlist API 被調用");
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    console.log("🔧 認證檢查:", { currentUser: currentUser?._id, hasUser: !!currentUser });
    if (!currentUser) {
      console.log("❌ 用戶未登入");
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

    console.log(`🔧 準備更新用戶 ${user.username} (${user._id}) 的播放清單:`, playlist);
    console.log(`🔧 更新前的播放清單:`, user.playlist);
    
    user.playlist = playlist;
    console.log(`🔧 設置播放清單後:`, user.playlist);
    
    // 強制保存並等待完成
    await user.save();
    console.log(`🔧 保存完成`);
    
    // 重新查詢數據庫確認保存
    const verifyUser = await User.findById(currentUser._id);
    console.log(`🔧 驗證查詢結果:`, verifyUser.playlist);
    console.log(`🔧 驗證長度:`, verifyUser.playlist?.length || 0);

    console.log(`✅ 用戶 ${user.username} 的播放清單已更新:`, playlist);
    console.log(`🔧 更新後的播放清單:`, user.playlist);

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


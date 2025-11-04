// app/api/user/save-playlist/route.js
import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import { dbConnect } from "@/lib/db";

export async function POST(req) {
  let playlist = null;
  
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    const body = await req.json();
    playlist = body.playlist;
    
    if (!Array.isArray(playlist)) {
      return NextResponse.json({ success: false, message: "播放清單格式錯誤" }, { status: 400 });
    }

    // ✅ 允許空播放清單
    if (playlist.length === 0) {
      // 空播放清單可以直接保存
    } else {
      // 驗證播放清單項目（只有在有項目時才驗證）
      const isValid = playlist.every(item => 
        item && 
        typeof item.title === 'string' && 
        typeof item.url === 'string' &&
        item.url.trim().length > 0
      );

      if (!isValid) {
        return NextResponse.json({ success: false, message: "播放清單項目格式錯誤" }, { status: 400 });
      }
    }

    // ✅ 使用 findByIdAndUpdate 避免版本衝突（VersionError）
    // 確保播放清單格式正確（轉換為 Mongoose Schema 格式）
    const formattedPlaylist = playlist.map(item => ({
      title: String(item.title || ''),
      url: String(item.url || '')
    }));

    // ✅ 檢查用戶是否已釘選自己的播放器
    // 如果已釘選，需要同時更新 pinnedPlayer.playlist，避免使用舊的快照
    const userBeforeUpdate = await User.findById(currentUser._id).lean();
    const hasPinnedOwnPlayer = userBeforeUpdate?.pinnedPlayer?.userId && 
      String(userBeforeUpdate.pinnedPlayer.userId) === String(currentUser._id);
    
    // 準備更新數據
    const updateData = { playlist: formattedPlaylist };
    
    // ✅ 如果用戶已釘選自己的播放器，同時更新 pinnedPlayer.playlist
    if (hasPinnedOwnPlayer) {
      updateData['pinnedPlayer.playlist'] = formattedPlaylist;
      console.log('✅ [save-playlist] 用戶已釘選自己的播放器，同時更新 pinnedPlayer.playlist');
    }

    // 使用 findByIdAndUpdate 直接更新，避免版本衝突
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      updateData,
      { 
        new: true, // 返回更新後的文檔
        runValidators: true, // 運行驗證器
        lean: false // 返回 Mongoose 文檔（用於訪問 playlist）
      }
    );

    if (!updatedUser) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "播放清單已保存",
      playlist: updatedUser.playlist
    });

  } catch (error) {
    console.error("❌ 保存播放清單錯誤:", error);
    console.error("❌ 錯誤詳情:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      playlistLength: playlist?.length || 0,
      playlistType: typeof playlist
    });
    
    // ✅ 返回更詳細的錯誤信息（僅在開發環境）
    const isDevelopment = process.env.NODE_ENV === 'development';
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤",
      error: isDevelopment ? error.message : "保存播放清單時發生錯誤",
      ...(isDevelopment && { stack: error.stack })
    }, { status: 500 });
  }
}


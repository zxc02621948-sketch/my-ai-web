import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { deleteFromR2 } from "@/lib/r2";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const music = await Music.findById(id);

    if (!music) {
      return NextResponse.json({ error: "音樂不存在" }, { status: 404 });
    }

    // 檢查是否為音樂擁有者或管理員
    const isOwner = music.author.toString() === user._id.toString();
    const isAdmin = user.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "無權限刪除此音樂" }, { status: 403 });
    }

    try {
      // 從 R2 刪除檔案
      // 從 URL 提取 key: https://media.aicreateaworld.com/music/userId/filename.mp3 -> music/userId/filename.mp3
      if (music.musicUrl) {
        const url = new URL(music.musicUrl);
        const r2Key = url.pathname.substring(1); // 移除開頭的 /

        await deleteFromR2(r2Key);
      }
    } catch (r2Error) {
      // 即使 R2 刪除失敗，仍繼續刪除資料庫記錄
    }

    // 從資料庫刪除
    await Music.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "音樂已刪除",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "刪除音樂失敗", details: error.message },
      { status: 500 },
    );
  }
}

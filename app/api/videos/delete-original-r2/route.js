import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { deleteFromR2 } from "@/lib/r2";

function extractR2KeyFromUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return "";
  }
}

export async function DELETE(req) {
  const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
  if (!currentUser?._id) {
    return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const directKey = String(body?.videoKey || "").trim();
    const fromUrl = extractR2KeyFromUrl(body?.videoUrl);
    const key = directKey || fromUrl;

    if (!key) {
      return NextResponse.json(
        { success: false, message: "缺少 videoKey 或 videoUrl" },
        { status: 400 }
      );
    }

    // 僅允許刪除自己上傳路徑，避免濫刪他人檔案
    const expectedPrefix = `videos/${String(currentUser._id)}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ success: false, message: "無權限刪除此檔案" }, { status: 403 });
    }

    await deleteFromR2(key);
    return NextResponse.json({ success: true, deletedKey: key });
  } catch (error) {
    console.error("❌ 刪除 R2 影片檔失敗:", error);
    return NextResponse.json({ success: false, message: "刪除失敗" }, { status: 500 });
  }
}

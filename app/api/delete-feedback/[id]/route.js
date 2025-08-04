// app/api/delete-feedback/[id]/route.js
import { dbConnect } from "@/lib/db";
import { Feedback } from "@/models/Feedback";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { NextResponse } from "next/server";

export async function DELETE(req, context) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUserFromRequest(req);

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: "無權限操作" }, { status: 403 });
    }

    const { id } = context.params;

    const deleted = await Feedback.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "找不到資料" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("刪除失敗：", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

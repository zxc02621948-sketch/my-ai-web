// app/api/delete-image/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Image from "@/models/Image";              // 若你的 Image 是具名匯出，改成 { Image }
import Notification from "@/models/Notification"; // 若是具名匯出，改成 { Notification }

/** ========= 小工具 ========= */
const json = (data, status = 200) =>
  NextResponse.json(data, { status });

const badRequest = (msg = "Bad request") => json({ ok: false, message: msg }, 400);
const unauthorized = (msg = "Unauthorized") => json({ ok: false, message: msg }, 401);
const forbidden = (msg = "Forbidden") => json({ ok: false, message: msg }, 403);
const serverError = (err) =>
  json({ ok: false, message: "Server error", error: String(err?.message || err) }, 500);

/** ========= 這裡接上你的實際驗證 =========
 *  目前先做「只要帶了 Bearer Token 就放行」，
 *  你之後把 verifyBearerToken 改成解析 JWT / Session 即可。
 */
async function verifyBearerToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  // TODO: 依你的專案邏輯做真正驗證（例如 jwt.verify / 取 Session）
  // return { userId, role } 之類的 payload
  return { userId: null, role: "admin" }; // 預設視為管理員，方便你先打通流程
}

/** ========= 刪除圖片 ========= */
export async function POST(req) {
  await dbConnect();

  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const me = await verifyBearerToken(authHeader);
    if (!me) return unauthorized("請先登入");

    const isAdmin = me.role === "admin";
    const currentUserId = me.userId ? String(me.userId) : null;

    // 2) Body
    const { imageId } = await req.json();
    if (!imageId) return badRequest("缺少 imageId");

    // 3) 取資料（可選擴充：若要回傳作者名稱/通知用，可 populate）
    const image = await Image.findById(imageId).populate("user", "_id username email");
    if (!image) return badRequest("找不到圖片");

    // 4) 權限檢查：非管理員時，必須是擁有者
    //    注意：image.user 可能是 ObjectId，也可能被 populate 成 object
    const ownerId =
      image?.user && typeof image.user === "object" && image.user._id
        ? String(image.user._id)
        : String(image.user);

    if (!isAdmin) {
      if (!currentUserId) return unauthorized("身分驗證失敗");
      const isOwner = ownerId === currentUserId;
      if (!isOwner) return forbidden("你沒有權限刪除這張圖片");
    }

    // 5) （可選）刪 Cloudflare Image 檔案
    // if (image.imageId) {
    //   try {
    //     const res = await fetch(
    //       `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/images/v1/${image.imageId}`,
    //       {
    //         method: "DELETE",
    //         headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
    //       }
    //     );
    //     if (!res.ok) {
    //       console.warn("Cloudflare delete failed:", await res.text());
    //     }
    //   } catch (e) {
    //     console.warn("Cloudflare delete error:", e);
    //   }
    // }

    // 6) 刪除關聯資料（通知等；若你的 Notification 是具名匯出，請改 import 及此行）
    try {
      await Notification.deleteMany({ imageId: image._id });
    } catch (e) {
      console.warn("Notification cleanup error:", e?.message || e);
    }

    // 7) 刪 DB 主資料
    await Image.deleteOne({ _id: imageId });

    return json({ ok: true, message: "已刪除圖片", deletedId: imageId }, 200);
  } catch (err) {
    console.error("delete-image error:", err);
    return serverError(err);
  }
}

// app/api/delete-image/route.js
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import User from "@/models/User";
import Comment from "@/models/Comment";
import { Notification } from "@/models/Notification";
import Message from "@/models/Message";
import jwt from "jsonwebtoken";
import axios from "axios";

/** 把你原本的刪除流程抽成共用：Cloudflare 刪圖、清留言、清通知、刪 DB */
async function deleteImageAndCleanup(image, currentUserId) {
  // 1) 刪 Cloudflare 圖片（可略過 not found）
  if (image?.imageId) {
    try {
      await axios.delete(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${image.imageId}`,
        { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}` } }
      );
    } catch (error) {
      const msg = error?.response?.data?.errors?.[0]?.message || "";
      console.error("❌ Cloudflare 刪除錯誤：", error?.response?.data || error?.message);
      if (!msg.includes("not found")) {
        throw new Error("Cloudflare 刪除失敗");
      } else {
        console.warn("⚠️ Cloudflare 圖片不存在，略過刪除");
      }
    }
  }

  // 2) 清空留言（保留痕跡）
  await Comment.updateMany(
    { imageId: image._id },
    {
      $set: {
        isDeleted: true,
        deletedBy: currentUserId,
        deletedAt: new Date(),
        text: "[圖片已刪除，此留言已清空]",
      },
    }
  );

  // 3) 清除通知
  await Notification.deleteMany({ imageId: image._id });

  // 4) 刪 Image 記錄
  await Image.findByIdAndDelete(image._id);
}

/** 站內信模板 */
function ratingLabel(r) {
  if (r === "18" || r === 18) return "18+";
  if (r === "15" || r === 15) return "15+";
  return "一般";
}
const SUBJECTS = {
  category_wrong: "作品分類已被調整",
  rating_wrong: "作品分級已被調整",
  policy_violation: "作品因違反規範已被移除",
  duplicate_content: "作品因重複內容已被移除",
};
const BODIES = {
  category_wrong: ({ title, oldCategory, newCategory, note }) =>
    `你的作品「${title}」分類已由「${oldCategory ?? "未填"}」調整為「${newCategory}」。${note ? "\n補充：" + note : ""}`,
  rating_wrong: ({ title, oldRating, newRating, note }) =>
    `你的作品「${title}」分級已由「${ratingLabel(oldRating)}」調整為「${ratingLabel(newRating)}」。${note ? "\n補充：" + note : ""}`,
  policy_violation: ({ title, note }) =>
    `你的作品「${title}」因違反平台規範已被移除。${note ? "\n補充：" + note : ""}`,
  duplicate_content: ({ title, note }) =>    
    `你的作品「${title}」因與站內其他作品重複，已被移除。${note ? "\n補充：" + note : ""}`,
};

/** 你的訊息 API 使用的會話規則（pair:<較小值>:<較大值>；系統端固定 "system"） */
function makePairCid(userId) {
  const a = String(userId);
  const b = "system";
  const [x, y] = [a, b].sort();
  return `pair:${x}:${y}`;
}

/** 寄出系統站內信（fromId=null, kind="system"；補 subject/body；conversationId 用 pair:<toId>:system） */
async function sendSystemMessage({ toId, subject, body, image }) {
  const sub = String(subject || "").trim() || "系統通知";
  const bod = String(body || "").trim() || "（無內容）";
  const cid = makePairCid(toId);

  await Message.create({
    conversationId: cid,   // ✅ 直接寫對話 ID，列表/Thread 會命中
    fromId: null,          // 系統
    toId,
    subject: sub,
    body: bod,
    kind: "system",
    ref: { type: "image", id: image?._id },
    isRead: false,
    createdAt: new Date(),
  });
}

export async function POST(req) {
  await connectToDatabase();

  try {
    const payload = await req.json();
    const {
      imageId,
      // 管理員審核用參數（由前端 AdminModerationBar 帶上）
      adminModeration = false,
      adminAction,          // 'delete' | 'reclassify' | 'rerate'
      reasonCode,           // 'policy_violation' | 'category_wrong' | 'rating_wrong'
      newCategory,          // reclassify 時需要
      newRating,            // rerate 時需要
      note = "",
    } = payload || {};

    if (!imageId) {
      return NextResponse.json({ message: "缺少 imageId" }, { status: 400 });
    }

    // 認證（你的既有 JWT）
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ message: "未授權：缺少 Token" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ message: "Token 驗證失敗" }, { status: 401 });
    }
    const currentUserId = decoded.id;

    // 取圖片與操作者
    const [image, user] = await Promise.all([
      Image.findById(imageId).populate("user", "_id username email"),
      User.findById(currentUserId),
    ]);
    if (!image) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    const isAdmin = user?.isAdmin === true;

    // ===================== 管理員審核分支 =====================
    if (adminModeration === true) {
      if (!isAdmin) {
        return NextResponse.json({ message: "需要管理員權限" }, { status: 403 });
      }

      const reason = ["category_wrong", "rating_wrong", "policy_violation"].includes(reasonCode)
        ? reasonCode
        : "policy_violation";
      const cleanNote = String(note || "").trim();

      // A) 刪除圖片（寄信）
      if (adminAction === "delete") {
        await deleteImageAndCleanup(image, currentUserId);

        await sendSystemMessage({
          toId: image.user?._id,
          subject: SUBJECTS[reason],
          body: BODIES[reason]({ title: image.title || "(未命名)", note: cleanNote }),
          image,
        });

        return NextResponse.json({ ok: true, summary: "已刪除並寄出站內信" });
      }

      // B) 更改分類（寄信）
      if (adminAction === "reclassify") {
        if (!newCategory) {
          return NextResponse.json({ ok: false, message: "缺少新分類" }, { status: 400 });
        }
        const oldCategory = image.category || null;
        await Image.updateOne({ _id: image._id }, { $set: { category: newCategory } });

        await sendSystemMessage({
          toId: image.user?._id,
          subject: SUBJECTS.category_wrong,
          body: BODIES.category_wrong({
            title: image.title || "(未命名)",
            oldCategory,
            newCategory,
            note: cleanNote,
          }),
          image,
        });

        return NextResponse.json({ ok: true, summary: "已更改分類並寄出站內信" });
      }

      // C) 更改分級（寄信）
      if (adminAction === "rerate") {
        if (!newRating) {
          return NextResponse.json({ ok: false, message: "缺少新分級" }, { status: 400 });
        }
        const oldRating = image.rating || "all";
        await Image.updateOne({ _id: image._id }, { $set: { rating: String(newRating) } });

        await sendSystemMessage({
          toId: image.user?._id,
          subject: SUBJECTS.rating_wrong,
          body: BODIES.rating_wrong({
            title: image.title || "(未命名)",
            oldRating,
            newRating,
            note: cleanNote,
          }),
          image,
        });

        return NextResponse.json({ ok: true, summary: "已更改分級並寄出站內信" });
      }

      return NextResponse.json({ ok: false, message: "未知的 adminAction" }, { status: 400 });
    }

    // ===================== 一般使用者自刪分支 =====================
    if (!isAdmin) {
      const isOwner = image.user?.toString?.() === currentUserId;
      if (!isOwner) {
        return NextResponse.json({ message: "你沒有權限刪除這張圖片" }, { status: 403 });
      }
    }

    await deleteImageAndCleanup(image, currentUserId);
    return NextResponse.json({ ok: true, message: "圖片與留言刪除成功" });
  } catch (error) {
    console.error("伺服器錯誤：", error);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}

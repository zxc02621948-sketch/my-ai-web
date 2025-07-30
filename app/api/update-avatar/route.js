// /app/api/update-avatar/route.js

import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function PUT(req) {
  await dbConnect();

  const user = await getCurrentUser(req);
  if (!user) return new NextResponse("未授權", { status: 401 });

  const { imageUrl } = await req.json();
  if (!imageUrl) return new NextResponse("缺少 imageUrl", { status: 400 });

  try {
    const dbUser = await User.findById(user._id);
    const oldImageId = dbUser.image;

    // ✅ 更新為新圖 ID
    dbUser.image = imageUrl;
    await dbUser.save();

    // ✅ 刪除舊圖（非空值、非預設圖）
    const isRealImageId = typeof oldImageId === "string" && oldImageId.trim() !== "";
    const isNotDefault = oldImageId !== "b479a9e9-6c1a-4c6a-94ff-283541062d00";

    if (isRealImageId && isNotDefault) {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${oldImageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ 頭像更新失敗", err);
    return new NextResponse("伺服器錯誤", { status: 500 });
  }
}

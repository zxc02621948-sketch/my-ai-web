// app/api/search/route.js
export const dynamic = 'force-dynamic';

import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  try {
    const query = q
      ? {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { tags: { $elemMatch: { $regex: q, $options: "i" } } },
          ],
        }
      : {};

    const images = await Image.find(query)
      .select("title tags user")
      .populate("user", "username")
      .limit(20)
      .lean();

    const all = images.flatMap((img) => [
      img.title,
      ...(img.tags || []),
      img.user?.username || "",
    ]);

    const unique = Array.from(new Set(all.filter(Boolean)));
    return Response.json(unique);
  } catch (err) {
    console.error("讀取建議詞失敗：", err);
    return new Response("Failed to fetch suggestions", { status: 500 });
  }
}

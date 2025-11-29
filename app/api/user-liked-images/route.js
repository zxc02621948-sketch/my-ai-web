// app/api/user-liked-images/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import User from "@/models/User";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  try {
    await dbConnect();

    let userId = null;

    // ✅ 支持 ObjectId 和 username 兩種查詢方式
    if (mongoose.Types.ObjectId.isValid(id)) {
      // 如果是有效的 ObjectId，直接使用
      userId = id;
    } else {
      // 如果不是 ObjectId，嘗試作為 username 查詢
      const user = await User.findOne({ username: id }).select('_id').lean();
      if (user) {
        userId = user._id.toString();
      } else {
        // 找不到用戶，返回空陣列
        return NextResponse.json({ items: [] }, { status: 200, ...noStore });
      }
    }

    if (!userId) {
      return NextResponse.json({ items: [] }, { status: 200, ...noStore });
    }

    // ✅ 查詢時同時匹配 ObjectId 和字符串格式的 likes（兼容舊數據）
    const userIdObjectId = new mongoose.Types.ObjectId(userId);
    
    // ✅ 使用 $or 同時查詢 ObjectId 和字符串格式，確保能找到所有數據
    const query = {
      $or: [
        { likes: userIdObjectId },
        { likes: userId },
        { likes: userIdObjectId.toString() },
        { likes: userId.toString() }
      ]
    };
    
    // ✅ 調試：先檢查是否有任何包含該用戶的 likes
    const totalImagesWithLikes = await Image.countDocuments({ likes: { $exists: true, $ne: [] } });
    const countWithObjectId = await Image.countDocuments({ likes: userIdObjectId });
    const countWithString = await Image.countDocuments({ likes: userId });
    const countWithQuery = await Image.countDocuments(query);
    
    console.log(`[user-liked-images] 查詢用戶 ${id} (${userId}):`, {
      userId,
      userIdObjectId: userIdObjectId.toString(),
      totalImagesWithLikes,
      countWithObjectId,
      countWithString,
      countWithQuery
    });
    
    // ✅ 查詢收藏列表
    const items = await Image.find(query)
      .populate('user', '_id username avatar currentFrame frameSettings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    console.log(`[user-liked-images] 找到 ${items.length} 個結果`);
    
    // ✅ 如果 countDocuments 有結果但 find 沒有，檢查數據格式
    if (items.length === 0 && (countWithObjectId > 0 || countWithString > 0)) {
      console.warn(`[user-liked-images] 警告：countDocuments 找到數據但 find 返回空`);
      
      // 查詢一個包含該用戶 likes 的樣本
      const sample = await Image.findOne({ 
        $or: [
          { likes: userIdObjectId },
          { likes: userId }
        ]
      })
        .select('_id likes')
        .lean();
      
      if (sample && sample.likes) {
        console.log(`[user-liked-images] 樣本數據:`, {
          imageId: sample._id,
          likesCount: sample.likes.length,
          likes: sample.likes.map(l => ({
            value: String(l),
            type: typeof l,
            constructor: l?.constructor?.name,
            isObjectId: l instanceof mongoose.Types.ObjectId || l?.constructor?.name === 'ObjectId'
          }))
        });
      }
    }
    
    // ✅ 如果還是沒有結果，嘗試查詢所有有 likes 的圖片，看看格式
    if (items.length === 0 && totalImagesWithLikes > 0) {
      const sampleAny = await Image.findOne({ likes: { $exists: true, $ne: [] } })
        .select('_id likes')
        .lean()
        .limit(1);
      
      if (sampleAny && sampleAny.likes && sampleAny.likes.length > 0) {
        console.log(`[user-liked-images] 任意樣本 likes 格式:`, {
          imageId: sampleAny._id,
          likesCount: sampleAny.likes.length,
          firstLike: {
            value: String(sampleAny.likes[0]),
            type: typeof sampleAny.likes[0],
            constructor: sampleAny.likes[0]?.constructor?.name,
            isObjectId: sampleAny.likes[0] instanceof mongoose.Types.ObjectId
          }
        });
      }
      
      // ✅ 直接查詢：使用原生 MongoDB 查詢，看看是否有包含該用戶 ID 的 likes
      const rawQuery = await Image.collection.find({
        likes: { $in: [userIdObjectId, userId] }
      }).limit(5).toArray();
      
      console.log(`[user-liked-images] 原生 MongoDB 查詢結果:`, {
        foundCount: rawQuery.length,
        samples: rawQuery.map(img => ({
          id: img._id,
          likesCount: img.likes?.length || 0,
          likes: img.likes?.map(l => String(l)) || []
        }))
      });
      
      // ✅ 如果原生查詢有結果，但 Mongoose 查詢沒有，說明是 Mongoose 的問題
      if (rawQuery.length > 0 && items.length === 0) {
        console.warn(`[user-liked-images] 警告：原生 MongoDB 查詢找到 ${rawQuery.length} 個結果，但 Mongoose 查詢返回 0 個！`);
        // 嘗試使用原生查詢的結果
        const rawIds = rawQuery.map(img => img._id);
        const mongooseItems = await Image.find({ _id: { $in: rawIds } })
          .populate('user', '_id username avatar currentFrame frameSettings')
          .sort({ createdAt: -1 })
          .lean()
          .exec();
        console.log(`[user-liked-images] 使用原生查詢 ID 列表，Mongoose 找到 ${mongooseItems.length} 個結果`);
        return NextResponse.json({ items: mongooseItems }, { status: 200, ...noStore });
      }
    }

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-liked-images] error:", err);
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}

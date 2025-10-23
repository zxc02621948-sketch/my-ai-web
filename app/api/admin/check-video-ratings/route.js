// app/api/admin/check-video-ratings/route.js
// 檢查影片評級分佈

import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();
    
    // 檢查各評級分佈
    const allCount = await Video.countDocuments({ rating: 'all' });
    const sfwCount = await Video.countDocuments({ rating: 'sfw' });
    const fifteenCount = await Video.countDocuments({ rating: '15' });
    const eighteenCount = await Video.countDocuments({ rating: '18' });
    const totalCount = await Video.countDocuments({});
    
    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        all: allCount,
        sfw: sfwCount,
        fifteen: fifteenCount,
        eighteen: eighteenCount
      },
      needsMigration: allCount > 0
    });
    
  } catch (error) {
    console.error('❌ 檢查影片評級失敗：', error);
    return NextResponse.json({ 
      error: "檢查失敗", 
      details: error.message 
    }, { status: 500 });
  }
}

// app/api/admin/fix-video-ratings/route.js
// 修復影片評級：將 'all' 改為 'sfw'

import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await dbConnect();
    
    console.log('🔄 開始修復影片評級...');
    
    // 1. 檢查有多少影片使用 'all' 評級
    const allVideos = await Video.countDocuments({ rating: 'all' });
    console.log(`📊 找到 ${allVideos} 個使用 'all' 評級的影片`);
    
    if (allVideos === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "沒有需要修復的影片",
        allCount: 0,
        sfwCount: await Video.countDocuments({ rating: 'sfw' })
      });
    }
    
    // 2. 更新所有 'all' 評級為 'sfw'
    const result = await Video.updateMany(
      { rating: 'all' },
      { $set: { rating: 'sfw' } }
    );
    
    console.log(`✅ 成功更新 ${result.modifiedCount} 個影片的評級`);
    
    // 3. 驗證修復結果
    const remainingAll = await Video.countDocuments({ rating: 'all' });
    const sfwCount = await Video.countDocuments({ rating: 'sfw' });
    
    return NextResponse.json({
      success: true,
      message: `成功修復 ${result.modifiedCount} 個影片的評級`,
      stats: {
        modified: result.modifiedCount,
        remainingAll,
        sfwCount
      }
    });
    
  } catch (error) {
    console.error('❌ 修復影片評級失敗：', error);
    return NextResponse.json({ 
      error: "修復失敗", 
      details: error.message 
    }, { status: 500 });
  }
}

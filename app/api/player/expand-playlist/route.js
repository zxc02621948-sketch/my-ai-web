// app/api/player/expand-playlist/route.js
// 購買播放清單擴充

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

// 價格配置（根據當前上限決定價格）
const EXPANSION_CONFIG = [
  { fromSize: 5, toSize: 10, addSlots: 5, cost: 50 },     // 第 1 次
  { fromSize: 10, toSize: 15, addSlots: 5, cost: 100 },   // 第 2 次
  { fromSize: 15, toSize: 20, addSlots: 5, cost: 200 },   // 第 3 次
  { fromSize: 20, toSize: 30, addSlots: 10, cost: 400 },  // 第 4 次
  { fromSize: 30, toSize: 40, addSlots: 10, cost: 600 },  // 第 5 次
  { fromSize: 40, toSize: 50, addSlots: 10, cost: 800 },  // 第 6 次（最終）
];

const MAX_PLAYLIST_SIZE = 50;

export async function POST(req) {
  try {
    await dbConnect();
    
    const authUser = await getCurrentUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    // 重新查詢用戶以獲取最新數據
    const currentUser = await User.findById(authUser._id);
    if (!currentUser) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    const currentMaxSize = currentUser.playlistMaxSize || 5;
    
    // 檢查是否已達上限
    if (currentMaxSize >= MAX_PLAYLIST_SIZE) {
      return NextResponse.json({ 
        error: "播放清單已達最大上限（50 首）",
        currentMax: currentMaxSize
      }, { status: 400 });
    }
    
    // 找到當前應該購買的擴充
    const expansion = EXPANSION_CONFIG.find(e => e.fromSize === currentMaxSize);
    
    if (!expansion) {
      return NextResponse.json({ 
        error: "無法找到對應的擴充選項",
        currentMax: currentMaxSize
      }, { status: 400 });
    }
    
    // 檢查積分是否足夠
    if (currentUser.pointsBalance < expansion.cost) {
      return NextResponse.json({ 
        error: `積分不足！需要 ${expansion.cost} 積分，你目前有 ${currentUser.pointsBalance} 積分`,
        need: expansion.cost,
        current: currentUser.pointsBalance
      }, { status: 400 });
    }
    
    // 扣除積分並擴充上限
    currentUser.pointsBalance -= expansion.cost;
    currentUser.playlistMaxSize = expansion.toSize;
    
    await currentUser.save();
    
    // 記錄交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: currentUser._id,
      type: "playlist_expansion",
      points: -expansion.cost,
      dateKey: dateKey,
      meta: {
        fromSize: expansion.fromSize,
        toSize: expansion.toSize,
        addSlots: expansion.addSlots,
        description: `播放清單擴充 +${expansion.addSlots} 首`
      }
    });
    
    // 廣播積分更新事件
    return NextResponse.json({
      success: true,
      message: `成功擴充播放清單！上限從 ${expansion.fromSize} 首增加到 ${expansion.toSize} 首`,
      data: {
        oldMax: expansion.fromSize,
        newMax: expansion.toSize,
        addSlots: expansion.addSlots,
        cost: expansion.cost,
        newBalance: currentUser.pointsBalance,
        nextExpansion: EXPANSION_CONFIG.find(e => e.fromSize === expansion.toSize) || null
      }
    });
    
  } catch (error) {
    console.error("播放清單擴充失敗:", error);
    return NextResponse.json({ 
      error: "擴充失敗",
      details: error.message 
    }, { status: 500 });
  }
}

// GET: 獲取當前擴充資訊
export async function GET(req) {
  try {
    await dbConnect();
    
    const authUser = await getCurrentUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    const currentUser = await User.findById(authUser._id);
    if (!currentUser) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    const currentMaxSize = currentUser.playlistMaxSize || 5;
    const currentPlaylistSize = currentUser.playlist?.length || 0;
    const nextExpansion = EXPANSION_CONFIG.find(e => e.fromSize === currentMaxSize);
    
    return NextResponse.json({
      success: true,
      data: {
        currentMax: currentMaxSize,
        currentSize: currentPlaylistSize,
        isMaxed: currentMaxSize >= MAX_PLAYLIST_SIZE,
        nextExpansion: nextExpansion ? {
          addSlots: nextExpansion.addSlots,
          newMax: nextExpansion.toSize,
          cost: nextExpansion.cost
        } : null,
        allExpansions: EXPANSION_CONFIG
      }
    });
    
  } catch (error) {
    console.error("獲取擴充資訊失敗:", error);
    return NextResponse.json({ 
      error: "獲取失敗" 
    }, { status: 500 });
  }
}


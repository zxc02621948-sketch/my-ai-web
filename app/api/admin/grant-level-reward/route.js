// app/api/admin/grant-level-reward/route.js
// 管理員工具：手動發放等級獎勵（用於測試）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    await dbConnect();
    
    const authUser = await getCurrentUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    // 檢查是否為管理員
    if (!authUser.isAdmin) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }
    
    const { level } = await req.json();
    
    if (![6, 10].includes(level)) {
      return NextResponse.json({ error: "只支援測試 LV6 和 LV10 獎勵" }, { status: 400 });
    }
    
    // 重新查詢用戶以獲取 Mongoose document（可以調用 .save()）
    const currentUser = await User.findById(authUser._id);
    if (!currentUser) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    // 發放獎勵
    if (level === 6) {
      // LV6: 免費釘選播放器 30 天
      const startDate = new Date();
      const expiresAt = new Date(startDate);
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const existingSub = currentUser.subscriptions?.find(s => s.type === 'pinPlayerTest' && s.isActive);
      
      if (existingSub) {
        return NextResponse.json({ 
          success: false,
          message: "已有試用訂閱",
          subscription: {
            type: existingSub.type,
            expiresAt: existingSub.expiresAt,
            daysLeft: Math.ceil((new Date(existingSub.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
          }
        });
      }
      
      currentUser.subscriptions.push({
        type: 'pinPlayerTest',
        startDate: startDate,
        expiresAt: expiresAt,
        isActive: true,
        monthlyCost: 0,
        lastRenewedAt: startDate
      });
      
      await currentUser.save();
      
      return NextResponse.json({ 
        success: true,
        message: "成功發放 LV6 獎勵：30 天釘選播放器試用",
        subscription: {
          type: 'pinPlayerTest',
          startDate: startDate,
          expiresAt: expiresAt,
          daysLeft: 30
        }
      });
    }
    
    if (level === 10) {
      // LV10: 永久釘選播放器
      const permanentDate = new Date('2099-12-31');
      
      const existingSub = currentUser.subscriptions?.find(s => s.type === 'pinPlayer' && s.isActive);
      
      if (existingSub) {
        // 檢查是否已經是永久訂閱
        if (existingSub.expiresAt > new Date('2099-01-01')) {
          return NextResponse.json({ 
            success: false,
            message: "已有永久訂閱",
            subscription: {
              type: existingSub.type,
              expiresAt: existingSub.expiresAt,
              permanent: true
            }
          });
        }
        
        // 如果是月租訂閱，升級為永久訂閱
        existingSub.expiresAt = permanentDate;
        existingSub.monthlyCost = 0; // 設為免費
        existingSub.lastRenewedAt = new Date();
        
        await currentUser.save();
        
        return NextResponse.json({ 
          success: true,
          message: "成功發放 LV10 獎勵：現有訂閱已升級為永久釘選播放器",
          subscription: {
            type: 'pinPlayer',
            expiresAt: permanentDate,
            permanent: true,
            upgraded: true
          }
        });
      }
      
      // 如果沒有訂閱，創建新的永久訂閱
      const startDate = new Date();
      currentUser.subscriptions.push({
        type: 'pinPlayer',
        startDate: startDate,
        expiresAt: permanentDate,
        isActive: true,
        monthlyCost: 0,
        lastRenewedAt: startDate
      });
      
      await currentUser.save();
      
      return NextResponse.json({ 
        success: true,
        message: "成功發放 LV10 獎勵：永久釘選播放器",
        subscription: {
          type: 'pinPlayer',
          startDate: startDate,
          expiresAt: permanentDate,
          permanent: true
        }
      });
    }
    
  } catch (error) {
    console.error("發放等級獎勵失敗:", error);
    return NextResponse.json({ 
      error: "發放失敗",
      details: error.message 
    }, { status: 500 });
  }
}


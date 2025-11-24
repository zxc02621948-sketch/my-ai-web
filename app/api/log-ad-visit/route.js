import { NextResponse } from 'next/server';
import { dbConnect } from '../../../lib/db';
import AdVisitorLog from '../../../models/AdVisitorLog';
import { getCurrentUserFromRequest } from '../../../lib/serverAuth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    await dbConnect();

    // 獲取請求數據
    const { path } = await request.json();
    
    // 獲取IP和User Agent
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referrer = request.headers.get('referer') || null;

    // 獲取當前用戶（如果已登入）
    const currentUser = await getCurrentUserFromRequest(request);
    const userId = currentUser?._id || null;

    // ✅ 檢查隱私設定：如果用戶關閉了數據分析，則不記錄廣告訪問
    if (currentUser && currentUser.privacyPreferences?.allowDataAnalytics === false) {
      return NextResponse.json({ 
        success: true, 
        message: 'Ad visit skipped (user disabled data analytics)',
        skipped: true
      });
    }

    // 廣告統計專用：更寬鬆的防重複機制（3秒內同IP同頁面才算重複）
    const threeSecondsAgo = new Date(Date.now() - 3 * 1000);
    
    const existingAdVisit = await AdVisitorLog.findOne({
      path,
      ip,
      createdAt: { $gte: threeSecondsAgo }
    });

    if (existingAdVisit) {
      return NextResponse.json({ 
        success: true, 
        message: 'Ad visit logged (duplicate within 3s, skipped)',
        isDuplicate: true 
      });
    }

    // 生成唯一的廣告訪問ID
    const visitId = `ad_${uuidv4()}`;
    
    // 生成會話ID（基於IP和UserAgent的簡單hash）
    const sessionId = Buffer.from(`${ip}_${userAgent}`).toString('base64').substring(0, 16);

    // 創建新的廣告訪問記錄
    const newAdVisit = new AdVisitorLog({
      path,
      ip,
      visitId,
      userAgent,
      userId,
      referrer,
      sessionId,
      createdAt: new Date()
    });

    await newAdVisit.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Ad visit logged successfully',
      visitId,
      isDuplicate: false
    });

  } catch (error) {
    console.error('[AD-VISIT] Error logging ad visit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log ad visit' },
      { status: 500 }
    );
  }
}
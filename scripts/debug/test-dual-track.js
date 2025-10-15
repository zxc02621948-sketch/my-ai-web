const { dbConnect } = require('./lib/db');
const VisitorLog = require('./models/VisitorLog');
const AdVisitorLog = require('./models/AdVisitorLog');

async function testDualTrackSystem() {
  try {
    await dbConnect();
    console.log('✅ 連接到數據庫成功');

    // 檢查最近的防刷量統計記錄
    console.log('\n🛡️ 防刷量統計 (VisitorLog) - 最近10條記錄:');
    const recentVisits = await VisitorLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('path ip visitId createdAt');
    
    recentVisits.forEach((visit, index) => {
      console.log(`${index + 1}. ${visit.createdAt.toISOString()} | ${visit.visitId} | ${visit.ip} -> ${visit.path}`);
    });

    // 檢查最近的廣告統計記錄
    console.log('\n💰 廣告統計 (AdVisitorLog) - 最近10條記錄:');
    const recentAdVisits = await AdVisitorLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('path ip visitId createdAt sessionId');
    
    if (recentAdVisits.length === 0) {
      console.log('❌ 沒有找到廣告統計記錄');
    } else {
      recentAdVisits.forEach((visit, index) => {
        console.log(`${index + 1}. ${visit.createdAt.toISOString()} | ${visit.visitId} | ${visit.ip} -> ${visit.path} | Session: ${visit.sessionId}`);
      });
    }

    // 統計今天的記錄數量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayVisits, todayAdVisits] = await Promise.all([
      VisitorLog.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      AdVisitorLog.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow }
      })
    ]);

    console.log('\n📊 今日統計:');
    console.log(`🛡️ 防刷量統計: ${todayVisits} 次訪問`);
    console.log(`💰 廣告統計: ${todayAdVisits} 次訪問`);

    // 檢查最近1小時的記錄
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [hourVisits, hourAdVisits] = await Promise.all([
      VisitorLog.countDocuments({
        createdAt: { $gte: oneHourAgo }
      }),
      AdVisitorLog.countDocuments({
        createdAt: { $gte: oneHourAgo }
      })
    ]);

    console.log('\n⏰ 最近1小時統計:');
    console.log(`🛡️ 防刷量統計: ${hourVisits} 次訪問`);
    console.log(`💰 廣告統計: ${hourAdVisits} 次訪問`);

    console.log('\n✅ 雙軌制統計系統測試完成');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    process.exit(0);
  }
}

testDualTrackSystem();
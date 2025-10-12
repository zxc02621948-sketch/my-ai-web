const mongoose = require('mongoose');
const PointsTransaction = require('./models/PointsTransaction.js').default;

async function testTotalEarned() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    
    const userId = new mongoose.Types.ObjectId('68844ed6ea9e04d4110aaf5c');
    
    console.log('Testing totalEarned calculation...');
    
    // 測試總積分聚合
    const totalAgg = await PointsTransaction.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    
    console.log('Total aggregation result:', totalAgg);
    console.log('Total earned:', Number(totalAgg?.[0]?.total || 0));
    
    // 測試本月積分聚合
    const now = new Date();
    const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    
    console.log('Start of month:', startOfMonthUTC);
    console.log('Start of next month:', startOfNextMonthUTC);
    
    const monthlyAgg = await PointsTransaction.aggregate([
      { $match: { userId: userId, createdAt: { $gte: startOfMonthUTC, $lt: startOfNextMonthUTC } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    
    console.log('Monthly aggregation result:', monthlyAgg);
    console.log('Monthly earned:', Number(monthlyAgg?.[0]?.total || 0));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testTotalEarned();



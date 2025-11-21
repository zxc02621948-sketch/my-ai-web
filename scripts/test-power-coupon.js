// scripts/test-power-coupon.js
// 测试权力券功能的脚本（不花费积分）

import mongoose from 'mongoose';

// 动态导入模型和工具函数
const User = (await import('../models/User.js')).default;
const Image = (await import('../models/Image.js')).default;
const Video = (await import('../models/Video.js')).default;
const Music = (await import('../models/Music.js')).default;
const PowerCoupon = (await import('../models/PowerCoupon.js')).default;
const { computePopScore, computeInitialBoostFromTop } = await import('../utils/score.js');
const { computeVideoPopScore, computeVideoInitialBoostFromTop } = await import('../utils/scoreVideo.js');
const { computeMusicPopScore, computeMusicInitialBoostFromTop } = await import('../utils/scoreMusic.js');

const POP_NEW_WINDOW_HOURS = 10;

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
    await mongoose.connect(uri);
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

/**
 * 创建测试权力券（不花费积分）
 */
async function createTestPowerCoupon(userId, type = '7day') {
  try {
    // 计算过期时间
    const expiryDate = new Date();
    if (type === '7day') {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else if (type === '30day') {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate.setTime(0); // rare券不过期
    }

    const powerCoupon = new PowerCoupon({
      userId: userId,
      type: type,
      quantity: 1,
      expiry: type === 'rare' ? null : expiryDate,
      used: false,
      purchasePrice: 0, // 测试用，不花费积分
      purchaseMethod: 'reward', // 标记为奖励
      isRare: type === 'rare'
    });

    await powerCoupon.save();
    console.log(`✅ 创建测试权力券成功: ${powerCoupon._id} (类型: ${type})`);
    return powerCoupon;
  } catch (error) {
    console.error('❌ 创建权力券失败:', error);
    throw error;
  }
}

/**
 * 在内容上使用权力券（测试用）
 */
async function usePowerCouponOnContent(couponId, contentType, contentId, userId) {
  try {
    const coupon = await PowerCoupon.findById(couponId);
    if (!coupon) {
      throw new Error('权力券不存在');
    }

    if (coupon.userId.toString() !== userId.toString()) {
      throw new Error('权力券不属于此用户');
    }

    if (coupon.used) {
      throw new Error('权力券已使用');
    }

    // 根据内容类型加载模型和内容
    let ContentModel;
    let computePopScoreFn;
    let computeInitialBoostFromTopFn;
    
    switch (contentType) {
      case 'image':
        ContentModel = Image;
        computePopScoreFn = computePopScore;
        computeInitialBoostFromTopFn = computeInitialBoostFromTop;
        break;
      case 'video':
        ContentModel = Video;
        computePopScoreFn = computeVideoPopScore;
        computeInitialBoostFromTopFn = computeVideoInitialBoostFromTop;
        break;
      case 'music':
        ContentModel = Music;
        computePopScoreFn = computeMusicPopScore;
        computeInitialBoostFromTopFn = computeMusicInitialBoostFromTop;
        break;
      default:
        throw new Error(`无效的内容类型: ${contentType}`);
    }

    const content = await ContentModel.findById(contentId);
    if (!content) {
      throw new Error(`${contentType} 不存在`);
    }

    // 检查内容是否属于用户
    const isOwner = contentType === 'image' 
      ? (content.user?.toString() === userId.toString() || content.userId?.toString() === userId.toString())
      : (content.author?.toString() === userId.toString());

    if (!isOwner) {
      throw new Error(`无权操作此${contentType === 'image' ? '图片' : contentType === 'video' ? '影片' : '音樂'}`);
    }

    // 检查内容是否上传超过24小时
    const createdAt = content.createdAt || content.uploadDate;
    const contentAge = Date.now() - new Date(createdAt).getTime();
    const minAge = 24 * 60 * 60 * 1000;
    
    if (contentAge < minAge) {
      const remainingHours = Math.ceil((minAge - contentAge) / (60 * 60 * 1000));
      throw new Error(`内容需上传超过24小时才能使用权力券，还需等待 ${remainingHours} 小时`);
    }

    // 计算 initialBoost
    const maxScoreDoc = await ContentModel.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
    const newInitialBoost = computeInitialBoostFromTopFn(maxScoreDoc?.popScore || 0);

    // 更新内容
    content.initialBoost = newInitialBoost;
    content.powerUsed = true;
    content.powerUsedAt = new Date();
    content.powerExpiry = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10小时后过期
    content.powerType = coupon.type;

    // 计算新分数
    const contentForScore = content.toObject ? content.toObject() : { ...content };
    contentForScore.initialBoost = newInitialBoost;
    contentForScore.powerUsed = true;
    contentForScore.powerUsedAt = content.powerUsedAt;
    contentForScore.powerExpiry = content.powerExpiry;
    contentForScore.powerType = coupon.type;

    content.popScore = computePopScoreFn(contentForScore);
    await content.save();

    // 更新权力券
    coupon.used = true;
    coupon.usedAt = new Date();
    if (contentType === 'image') {
      coupon.usedOnImage = contentId; // 向后兼容
    }
    coupon.usedOnContentId = contentId;
    coupon.contentType = contentType;
    await coupon.save();

    // 更新用户的 activePowerItems
    const user = await User.findById(userId);
    if (!user.activePowerItems) {
      user.activePowerItems = [];
    }

    // 移除已经不在使用中的项目
    user.activePowerItems = user.activePowerItems.filter(item => {
      return !(String(item.contentId) === String(contentId) && item.contentType === contentType);
    });

    // 添加新项目
    user.activePowerItems.push({
      contentId: contentId,
      contentType: contentType
    });

    // 向后兼容：更新 activePowerImages（如果是图片）
    if (contentType === 'image') {
      if (!user.activePowerImages) {
        user.activePowerImages = [];
      }
      if (!user.activePowerImages.includes(contentId)) {
        user.activePowerImages.push(contentId);
      }
    }

    user.lastPowerUse = new Date();
    await user.save();

    console.log(`✅ 权力券使用成功: ${contentType} (${content.title || contentId})`);
    console.log(`   - 初始加成: ${newInitialBoost}`);
    console.log(`   - 当前分数: ${content.popScore}`);
    console.log(`   - 权力券使用时间: ${content.powerUsedAt.toLocaleString('zh-TW')}`);
    console.log(`   - 权力券过期时间: ${content.powerExpiry.toLocaleString('zh-TW')}`);

    return {
      content,
      coupon,
      initialBoost: newInitialBoost,
      popScore: content.popScore
    };
  } catch (error) {
    console.error('❌ 使用权力券失败:', error.message);
    throw error;
  }
}

/**
 * 验证权力券加成
 */
async function verifyPowerCouponBoost(contentType, contentId) {
  try {
    let ContentModel;
    let computePopScoreFn;
    
    switch (contentType) {
      case 'image':
        ContentModel = Image;
        computePopScoreFn = computePopScore;
        break;
      case 'video':
        ContentModel = Video;
        computePopScoreFn = computeVideoPopScore;
        break;
      case 'music':
        ContentModel = Music;
        computePopScoreFn = computeMusicPopScore;
        break;
      default:
        throw new Error(`无效的内容类型: ${contentType}`);
    }

    const content = await ContentModel.findById(contentId).lean();
    if (!content) {
      throw new Error('内容不存在');
    }

    const now = new Date();
    const effectiveCreatedAt = content.powerUsed && content.powerUsedAt && content.powerExpiry && new Date(content.powerExpiry) > now
      ? new Date(content.powerUsedAt)
      : new Date(content.createdAt || content.uploadDate);

    const hoursElapsed = (now - effectiveCreatedAt) / (1000 * 60 * 60);
    const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
    const currentBoost = (content.initialBoost || 0) * boostFactor;
    const stillInWindow = hoursElapsed < POP_NEW_WINDOW_HOURS;

    // 计算实时分数
    const livePopScore = computePopScoreFn(content);

    console.log('\n📊 权力券加成验证:');
    console.log(`   - 内容标题: ${content.title || contentId}`);
    console.log(`   - 上传时间: ${new Date(content.createdAt || content.uploadDate).toLocaleString('zh-TW')}`);
    console.log(`   - 权力券使用时间: ${content.powerUsedAt ? new Date(content.powerUsedAt).toLocaleString('zh-TW') : '无'}`);
    console.log(`   - 权力券过期时间: ${content.powerExpiry ? new Date(content.powerExpiry).toLocaleString('zh-TW') : '无'}`);
    console.log(`   - 有效创建时间: ${effectiveCreatedAt.toLocaleString('zh-TW')}`);
    console.log(`   - 经过小时: ${hoursElapsed.toFixed(2)}`);
    console.log(`   - 加成因子: ${boostFactor.toFixed(3)}`);
    console.log(`   - 当前加成: ${currentBoost.toFixed(2)}`);
    console.log(`   - 初始加成: ${content.initialBoost || 0}`);
    console.log(`   - 是否在窗口内: ${stillInWindow ? '✅ 是' : '❌ 否'}`);
    console.log(`   - 数据库分数: ${content.popScore || 0}`);
    console.log(`   - 实时分数: ${livePopScore.toFixed(2)}`);

    if (content.powerUsed && content.powerUsedAt) {
      const isUsingPowerTime = effectiveCreatedAt.getTime() === new Date(content.powerUsedAt).getTime();
      if (isUsingPowerTime) {
        console.log(`   - ✅ 正确：使用权力券时间计算加成`);
      } else {
        console.log(`   - ❌ 错误：应该使用权力券时间，但实际使用了上传时间`);
      }
    }

    return {
      content,
      effectiveCreatedAt,
      hoursElapsed,
      boostFactor,
      currentBoost,
      stillInWindow,
      livePopScore
    };
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  await connectDB();

  // 从命令行参数获取信息
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'create') {
    // 创建测试权力券
    // 用法: node scripts/test-power-coupon.js create <userId> [type]
    const userId = args[1];
    const type = args[2] || '7day'; // '7day', '30day', 'rare'

    if (!userId) {
      console.error('❌ 请提供用户ID');
      console.log('用法: node scripts/test-power-coupon.js create <userId> [type]');
      process.exit(1);
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ 用户不存在');
      process.exit(1);
    }

    const coupon = await createTestPowerCoupon(userId, type);
    console.log(`\n✅ 测试权力券创建成功!`);
    console.log(`   - 权力券ID: ${coupon._id}`);
    console.log(`   - 用户: ${user.username || userId}`);
    console.log(`   - 类型: ${type}`);
    console.log(`   - 过期时间: ${coupon.expiry ? new Date(coupon.expiry).toLocaleString('zh-TW') : '永不过期'}`);

  } else if (command === 'use') {
    // 使用权力券
    // 用法: node scripts/test-power-coupon.js use <couponId> <contentType> <contentId> <userId>
    const couponId = args[1];
    const contentType = args[2];
    const contentId = args[3];
    const userId = args[4];

    if (!couponId || !contentType || !contentId || !userId) {
      console.error('❌ 缺少必要参数');
      console.log('用法: node scripts/test-power-coupon.js use <couponId> <contentType> <contentId> <userId>');
      console.log('   contentType: image, video, music');
      process.exit(1);
    }

    await usePowerCouponOnContent(couponId, contentType, contentId, userId);
    await verifyPowerCouponBoost(contentType, contentId);

  } else if (command === 'verify') {
    // 验证权力券加成
    // 用法: node scripts/test-power-coupon.js verify <contentType> <contentId>
    const contentType = args[1];
    const contentId = args[2];

    if (!contentType || !contentId) {
      console.error('❌ 缺少必要参数');
      console.log('用法: node scripts/test-power-coupon.js verify <contentType> <contentId>');
      console.log('   contentType: image, video, music');
      process.exit(1);
    }

    await verifyPowerCouponBoost(contentType, contentId);

  } else if (command === 'list') {
    // 列出用户的所有权力券
    // 用法: node scripts/test-power-coupon.js list <userId>
    const userId = args[1];

    if (!userId) {
      console.error('❌ 请提供用户ID');
      console.log('用法: node scripts/test-power-coupon.js list <userId>');
      process.exit(1);
    }

    const coupons = await PowerCoupon.find({ userId }).sort({ createdAt: -1 });
    console.log(`\n📋 用户的权力券列表 (${coupons.length} 张):`);
    coupons.forEach((coupon, index) => {
      console.log(`\n${index + 1}. 权力券ID: ${coupon._id}`);
      console.log(`   - 类型: ${coupon.type}`);
      console.log(`   - 已使用: ${coupon.used ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 使用时间: ${coupon.usedAt ? new Date(coupon.usedAt).toLocaleString('zh-TW') : '未使用'}`);
      console.log(`   - 使用在: ${coupon.contentType || 'N/A'} (${coupon.usedOnContentId || 'N/A'})`);
      console.log(`   - 过期时间: ${coupon.expiry ? new Date(coupon.expiry).toLocaleString('zh-TW') : '永不过期'}`);
      console.log(`   - 创建时间: ${new Date(coupon.createdAt).toLocaleString('zh-TW')}`);
    });

  } else {
    console.log('❌ 无效的命令');
    console.log('\n可用命令:');
    console.log('  1. create - 创建测试权力券');
    console.log('     用法: node scripts/test-power-coupon.js create <userId> [type]');
    console.log('     示例: node scripts/test-power-coupon.js create 507f1f77bcf86cd799439011 7day');
    console.log('\n  2. use - 使用权力券');
    console.log('     用法: node scripts/test-power-coupon.js use <couponId> <contentType> <contentId> <userId>');
    console.log('     示例: node scripts/test-power-coupon.js use 507f1f77bcf86cd799439012 image 507f1f77bcf86cd799439013 507f1f77bcf86cd799439011');
    console.log('\n  3. verify - 验证权力券加成');
    console.log('     用法: node scripts/test-power-coupon.js verify <contentType> <contentId>');
    console.log('     示例: node scripts/test-power-coupon.js verify image 507f1f77bcf86cd799439013');
    console.log('\n  4. list - 列出用户的所有权力券');
    console.log('     用法: node scripts/test-power-coupon.js list <userId>');
    console.log('     示例: node scripts/test-power-coupon.js list 507f1f77bcf86cd799439011');
    process.exit(1);
  }

  process.exit(0);
}

// 运行主函数
main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});


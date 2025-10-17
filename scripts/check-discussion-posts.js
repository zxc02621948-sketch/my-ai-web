const mongoose = require('mongoose');

// 連接到 MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cvb120g:j3j79ru06@my-ai-web.9ugvdto.mongodb.net/myaiweb?retryWrites=true&w=majority&appName=my-ai-web';

const DiscussionPostSchema = new mongoose.Schema({
  title: String,
  content: String,
  category: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [String],
  comments: [mongoose.Schema.Types.ObjectId],
  isPinned: { type: Boolean, default: false },
  pinnedAt: Date,
  pinnedBy: mongoose.Schema.Types.ObjectId,
  uploadedImage: String,
  imageRef: String,
  uploadedImages: [{
    url: String,
    imageId: String,
    fileName: String,
    fileSize: Number,
    width: Number,
    height: Number,
    order: Number
  }],
  imageCount: { type: Number, default: 0 },
  pointsCost: { type: Number, default: 0 },
  pendingPoints: { type: Number, default: 0 },
  claimedPoints: { type: Number, default: 0 },
  rewardedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastClaimedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'discussionposts' });

const DiscussionPost = mongoose.models.DiscussionPost || mongoose.model('DiscussionPost', DiscussionPostSchema);

async function checkDiscussionPosts() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: 'myaiweb' });
    console.log('✅ 已連接到 MongoDB');

    // 檢查所有討論帖
    const posts = await DiscussionPost.find({}).populate('author', 'username');
    
    console.log(`📋 找到 ${posts.length} 個討論帖:`);
    
    if (posts.length === 0) {
      console.log('❌ 沒有找到任何討論帖');
      console.log('💡 請先在討論區發一篇多圖教學帖來測試');
      return;
    }
    
    posts.forEach((post, index) => {
      console.log(`\n${index + 1}. ${post.title}`);
      console.log(`   - 作者: ${post.author?.username || '未知'}`);
      console.log(`   - 分類: ${post.category}`);
      console.log(`   - 圖片數量: ${post.imageCount || 0}`);
      console.log(`   - 點讚數: ${post.likes?.length || 0}`);
      console.log(`   - 待領取積分: ${post.pendingPoints || 0}`);
      console.log(`   - 已領取積分: ${post.claimedPoints || 0}`);
      console.log(`   - 獎勵用戶數: ${post.rewardedUsers?.length || 0}`);
      console.log(`   - 建立時間: ${post.createdAt}`);
    });

    // 找出多圖教學帖
    const multiImagePosts = posts.filter(post => post.imageCount > 1);
    console.log(`\n🎯 多圖教學帖 (${multiImagePosts.length} 個):`);
    multiImagePosts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title} - ${post.imageCount} 張圖片`);
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

checkDiscussionPosts();

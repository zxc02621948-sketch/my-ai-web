const mongoose = require('mongoose');

// 連接到 MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myaiweb';

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

async function resetDiscussionLikes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 重置所有討論帖的點讚記錄
    const result = await DiscussionPost.updateMany(
      {}, 
      { 
        $set: { 
          likes: [],
          pendingPoints: 0,
          claimedPoints: 0,
          rewardedUsers: [],
          lastClaimedAt: null
        }
      }
    );
    
    console.log(`✅ 已重置 ${result.modifiedCount} 個討論帖的點讚記錄`);
    
    // 顯示重置後的帖子
    const posts = await DiscussionPost.find({}).select('title author likes pendingPoints claimedPoints rewardedUsers').populate('author', 'username');
    console.log('\n📋 重置後的討論帖:');
    posts.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title} (作者: ${post.author?.username || '未知'})`);
      console.log(`   - 點讚: ${post.likes.length}, 待領取: ${post.pendingPoints}, 已領取: ${post.claimedPoints}, 獎勵用戶: ${post.rewardedUsers.length}`);
    });

    console.log('\n🎉 討論區點讚記錄重置完成！');
    console.log('💡 現在可以用測試帳號來點讚測試積分提領功能了！');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

resetDiscussionLikes();

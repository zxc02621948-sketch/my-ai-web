import mongoose from "mongoose";

const DiscussionPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "帖子標題是必填的"],
    maxLength: [200, "標題不能超過200個字符"],
    trim: true
  },
  content: {
    type: String,
    required: [true, "帖子內容是必填的"],
    maxLength: [10000, "內容不能超過10000個字符"],
    trim: true
  },
  category: {
    type: String,
    required: [true, "分類是必填的"],
    enum: {
      values: ["announcement", "technical", "showcase", "question", "tutorial", "general"],
      message: "分類必須是：announcement, technical, showcase, question, tutorial, general"
    }
  },
  rating: {
    type: String,
    enum: ["一般", "15", "18"],
    default: "一般"
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  
  // 图片相关
  imageRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Image",
    default: null
  },
  uploadedImage: {
    url: String,        // Cloudflare Images URL
    imageId: String,    // Cloudflare Images ID
    fileName: String,   // 原始文件名
    fileSize: Number,   // 文件大小
    width: Number,      // 图片宽度
    height: Number      // 图片高度
  },
  
  // 多图上传支持
  uploadedImages: [{
    url: String,        // Cloudflare Images URL
    imageId: String,    // Cloudflare Images ID
    fileName: String,   // 原始文件名
    fileSize: Number,   // 文件大小
    width: Number,      // 图片宽度
    height: Number,     // 图片高度
    order: Number       // 图片顺序
  }],
  imageCount: {
    type: Number,
    default: 0
  },
  
  // 积分相关
  pointsCost: {
    type: Number,
    default: 0
  },
  pendingPoints: {
    type: Number,
    default: 0
  },
  claimedPoints: {
    type: Number,
    default: 0
  },
  rewardedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }], // 已獲得積分獎勵的用戶ID列表（防止重複累積）
  lastClaimedAt: {
    type: Date,
    default: null
  },
  
  // 互动数据
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiscussionComment"
  }],
  commentsCount: {
    type: Number,
    default: 0
  },
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  bookmarksCount: {
    type: Number,
    default: 0
  },
  
  // 状态和元数据
  isPinned: {
    type: Boolean,
    default: false,
    index: true
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引优化
DiscussionPostSchema.index({ author: 1, createdAt: -1 });
DiscussionPostSchema.index({ category: 1, createdAt: -1 });
DiscussionPostSchema.index({ likesCount: -1, createdAt: -1 });
DiscussionPostSchema.index({ commentsCount: -1, createdAt: -1 });
DiscussionPostSchema.index({ isPinned: -1, createdAt: -1 });

// 中间件：更新时自动设置 updatedAt
DiscussionPostSchema.pre("save", function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// 中间件：确保互动计数同步
DiscussionPostSchema.pre("save", function(next) {
  this.likesCount = this.likes.length;
  this.commentsCount = this.comments.length;
  this.bookmarksCount = this.bookmarks.length;
  next();
});

// 实例方法
DiscussionPostSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(likeId => likeId.toString() === userId.toString());
};

DiscussionPostSchema.methods.isBookmarkedBy = function(userId) {
  return this.bookmarks.some(bookmarkId => bookmarkId.toString() === userId.toString());
};

DiscussionPostSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

DiscussionPostSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(likeId => likeId.toString() !== userId.toString());
  return this.save();
};

DiscussionPostSchema.methods.addBookmark = function(userId) {
  if (!this.isBookmarkedBy(userId)) {
    this.bookmarks.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

DiscussionPostSchema.methods.removeBookmark = function(userId) {
  this.bookmarks = this.bookmarks.filter(bookmarkId => bookmarkId.toString() !== userId.toString());
  return this.save();
};

DiscussionPostSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// 強制重新定義模型以清除緩存
if (mongoose.models.DiscussionPost) {
  delete mongoose.models.DiscussionPost;
}

export default mongoose.model("DiscussionPost", DiscussionPostSchema);

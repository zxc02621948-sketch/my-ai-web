import mongoose from "mongoose";

const DiscussionCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiscussionPost",
    required: true
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
  content: {
    type: String,
    required: [true, "評論內容是必填的"],
    maxLength: [2000, "評論內容不能超過2000個字符"],
    trim: true
  },
  
  // 回复功能
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiscussionComment",
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "DiscussionComment"
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  replyToName: {
    type: String,
    default: null,
    trim: true
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
  
  // 状态
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
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
DiscussionCommentSchema.index({ post: 1, createdAt: 1 });
DiscussionCommentSchema.index({ author: 1, createdAt: -1 });
DiscussionCommentSchema.index({ parentComment: 1, createdAt: 1 });

// 中间件：更新时自动设置 updatedAt
DiscussionCommentSchema.pre("save", function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// 中间件：确保点赞计数同步
DiscussionCommentSchema.pre("save", function(next) {
  this.likesCount = this.likes.length;
  next();
});

// 实例方法
DiscussionCommentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(likeId => likeId.toString() === userId.toString());
};

DiscussionCommentSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

DiscussionCommentSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(likeId => likeId.toString() !== userId.toString());
  return this.save();
};

DiscussionCommentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = "[此評論已被刪除]";
  return this.save();
};

export default mongoose.models.DiscussionComment || mongoose.model("DiscussionComment", DiscussionCommentSchema);

// utils/videoQuery.js
// 影片查詢的共用配置
// 統一管理所有影片相關查詢，避免不一致

/**
 * 作者資訊要 populate 的欄位
 * 統一管理，確保所有 API 返回一致的作者資訊
 */
export const VIDEO_AUTHOR_FIELDS = 'username avatar currentFrame frameSettings';

/**
 * 作者資訊的 aggregate $project 配置
 * 用於 MongoDB aggregation pipeline
 */
export const VIDEO_AUTHOR_PROJECT = {
  _id: 1,
  username: 1,
  avatar: 1,
  currentFrame: 1,
  frameSettings: 1
};

/**
 * 標準的作者 $lookup 配置
 * 用於 MongoDB aggregation pipeline
 */
export const VIDEO_AUTHOR_LOOKUP = {
  from: 'users',
  localField: 'author',
  foreignField: '_id',
  as: 'author',
  pipeline: [
    { $project: VIDEO_AUTHOR_PROJECT }
  ]
};

/**
 * 標準的 $unwind 配置
 * 用於將 author 陣列轉為單一物件
 */
export const VIDEO_AUTHOR_UNWIND = {
  path: '$author',
  preserveNullAndEmptyArrays: true
};

/**
 * 完整的作者資訊查詢階段（lookup + unwind）
 * 可直接插入 aggregate pipeline
 */
export const VIDEO_AUTHOR_STAGES = [
  { $lookup: VIDEO_AUTHOR_LOOKUP },
  { $unwind: VIDEO_AUTHOR_UNWIND }
];



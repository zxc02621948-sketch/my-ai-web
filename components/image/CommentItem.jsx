"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function CommentItem({
  comment,
  allComments = [],
  currentUser,
  onDelete,
  onReply,
  replyValue,
  onReplyChange,
  isReplying,
  toggleReplyInput,
  isExpanded,
  toggleExpand,
  depth = 0,
}) {
  const replies = allComments.filter((c) => c.parentCommentId === comment._id);
  const clampedDepth = Math.min(depth, 2);
  const indentClass = clampedDepth === 0 ? "" : clampedDepth === 1 ? "ml-4" : "ml-8";

  const visibleReplies = isExpanded ? replies : replies.slice(0, 1);

  return (
    <div className={`bg-neutral-700 p-2 rounded relative group ${indentClass}`}>
      {comment.parentCommentId && (
        <p className="text-xs text-blue-400 mb-1">
          → 回覆 @{allComments.find((c) => c._id === comment.parentCommentId)?.userName || "匿名用戶"}：
        </p>
      )}

      <p className="text-sm">{comment.text}</p>
      <p className="text-[11px] text-gray-400 mt-1">
        👤 {comment.userName} ・{" "}
        {formatDistanceToNow(new Date(comment.createdAt), {
          addSuffix: true,
          locale: zhTW,
        })}
      </p>

      {(currentUser?._id === comment.userId || currentUser?.role === "admin") && (
        <button
          onClick={() => onDelete(comment._id)}
          className="absolute top-1 right-1 text-gray-400 hover:text-red-500 transition text-xs hidden group-hover:block"
          title="刪除留言"
        >
          <Trash2 size={14} />
        </button>
      )}

      {currentUser && clampedDepth < 2 && (
        <button
          onClick={() => toggleReplyInput(comment._id)}
          className="text-xs text-blue-400 mt-1 hover:underline"
        >
          {isReplying ? "取消回覆" : "回覆"}
        </button>
      )}

      {isReplying && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={replyValue}
            onChange={(e) => onReplyChange(comment._id, e.target.value)}
            className="flex-1 rounded bg-neutral-800 text-white p-2 text-sm placeholder-gray-400"
            placeholder={`回覆 @${comment.userName}...`}
          />
          <button
            onClick={() => onReply(comment._id)}
            className="bg-blue-600 px-3 py-2 text-sm rounded hover:bg-blue-700 transition"
          >
            發送
          </button>
        </div>
      )}

      {clampedDepth < 2 && replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              allComments={allComments}
              currentUser={currentUser}
              onDelete={onDelete}
              onReply={onReply}
              replyValue={replyValue}
              onReplyChange={onReplyChange}
              isReplying={isReplying && reply._id === comment._id}
              toggleReplyInput={toggleReplyInput}
              isExpanded={isExpanded}
              toggleExpand={toggleExpand}
              depth={depth + 1}
            />
          ))}

          {replies.length > 1 && (
            <button
              onClick={() => toggleExpand(comment._id)}
              className="text-xs text-blue-300 hover:underline"
            >
              {isExpanded ? "收起回覆" : `查看其他 ${replies.length - 1} 則回覆`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

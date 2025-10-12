"use client";

import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import Link from "next/link";
import AvatarFrame from "@/components/common/AvatarFrame";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";

export default function CommentItem({
  comment,
  replies = [],
  currentUser,
  onDelete,
  onReply,
  replyInputs,
  onReplyChange,
  replyMap,
  toggleReplyInput,
}) {
  const isReplyingHere = replyMap?.[comment?._id] || false;
  const replyValueHere = replyInputs?.[comment?._id] || "";

  // 添加載入狀態檢查
  if (!comment) {
    return null; // 如果 comment 不存在，不渲染
  }

  const avatar = (() => {
    const imageId = comment?.userImage || DEFAULT_AVATAR_IDS.hidden;
    
    // 如果已經是完整 URL，直接使用
    if (typeof imageId === "string" && imageId.startsWith('http')) {
      return imageId;
    }
    
    // 如果是 ID，構建完整 URL
    return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/avatar`;
  })();
  const userFrame = comment?.userFrame || "default";

  const isTopLevel = comment?.parentCommentId === null;

  return (
    <div className="bg-neutral-700 p-2 rounded relative group">
      <div className="flex items-start gap-2">
        {/* 頭像與名稱 */}
        <div className="flex flex-col items-center w-[60px] pt-1">
          <AvatarFrame
            src={avatar}
            size={40}
            frameId={userFrame}
            showFrame={true}
            userId={comment?.userId}
          />
          <span className="text-xs text-white mt-1 text-center break-words">
            {comment?.userName}
          </span>
        </div>

        {/* 右側留言內容 */}
        <div className="flex-1 flex flex-col mt-1">
          <p className="text-sm break-all text-white leading-relaxed">
            {comment?.text?.split(/(@\w+)/g).map((part, idx) => {
              if (part.startsWith("@")) {
                const username = part.slice(1);
                return (
                  <Link
                    key={idx}
                    href={
                      part.slice(1) === comment?.parentUserName
                        ? `/user/${comment?.parentUserId}`
                        : `/user/${comment?.userId}`
                    }
                    className="text-blue-400 hover:underline"
                  >
                    {part}
                  </Link>
                );
              }
              return <span key={idx}>{part}</span>;
            })}
          </p>
          {/* 時間與操作按鈕 */}
          <div className="flex items-center text-[11px] text-gray-400 mt-2 gap-4">
            <p>
              🕒{" "}
              {comment?.createdAt
                ? formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: zhTW,
                  })
                : "時間未知"}
            </p>

            {/* 只有主留言可以回覆 */}
            {isTopLevel && currentUser && onReply && (
              <button
                onClick={() => toggleReplyInput(comment?._id, comment?.userName)}
                className="text-xs text-blue-400 hover:underline"
              >
                {isReplyingHere ? "取消回覆" : "回覆"}
              </button>
            )}
          </div>

          {/* 刪除按鈕 */}
          {(currentUser?._id === comment?.userId || currentUser?.isAdmin) && (
            <button
              onClick={() => onDelete(comment?._id)}
              className="absolute top-1 right-1 text-gray-400 hover:text-red-500 transition text-xs hidden group-hover:block"
              title="刪除留言"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* 回覆輸入框（僅限主留言） */}
          {isTopLevel && isReplyingHere && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyValueHere}
                onChange={(e) => onReplyChange(comment?._id, e.target.value)}
                className="flex-1 rounded bg-neutral-800 text-white p-2 text-sm placeholder-gray-400"
                placeholder={`回覆 @${comment?.userName}...`}
              />
              <button
                onClick={() => onReply(comment?._id)}
                className="bg-blue-600 px-3 py-2 text-sm rounded hover:bg-blue-700 transition"
              >
                發送
              </button>
            </div>
          )}

          {/* 回覆區塊（只呈現，不可再回覆） */}
          {replies.length > 0 && (
            <div className="mt-2 space-y-2 border-l border-gray-600 pl-3 ml-2">
              {replies.map((reply) => (
                <CommentItem
                  key={reply._id}
                  comment={reply}
                  replies={[]} // 禁止再巢狀
                  currentUser={currentUser}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

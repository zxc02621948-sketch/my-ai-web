"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import CommentItem from "./CommentItem";

export default function CommentBox({ imageId, onAddComment, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyMap, setReplyMap] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [replyExpandMap, setReplyExpandMap] = useState({});

  useEffect(() => {
    if (!imageId) return;
    const fetchComments = async () => {
      try {
        const res = await axios.get(`/api/comments/${imageId}`);
        setComments(res.data);
      } catch (err) {
        console.error("留言讀取錯誤：", err);
      }
    };
    fetchComments();
  }, [imageId]);

  const handleCommentSubmit = async (parentCommentId = null) => {
    const text = parentCommentId ? replyInputs[parentCommentId] : newComment;
    if (!text?.trim()) return;

    try {
      const res = await axios.post(`/api/comments/${imageId}`, {
        text,
        userId: currentUser?._id || "匿名用戶",
        userName: currentUser?.username || "匿名用戶",
        imageId,
        parentCommentId: typeof parentCommentId === "string" ? parentCommentId : null,
      });

      setComments((prev) => [
        ...prev,
        {
          _id: res.data.commentId,
          text,
          userId: currentUser?._id || "匿名用戶",
          userName: currentUser?.username || "匿名用戶",
          createdAt: new Date(),
          parentCommentId: parentCommentId || null,
        },
      ]);

      if (parentCommentId) {
        setReplyInputs((prev) => ({ ...prev, [parentCommentId]: "" }));
        setReplyMap((prev) => ({ ...prev, [parentCommentId]: false }));
      } else {
        setNewComment("");
      }
    } catch (err) {
      console.error("留言發送錯誤：", err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("你確定要刪除這則留言嗎？")) return;
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];

      await axios.delete(`/api/delete-comment/${commentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.error("留言刪除錯誤：", err);
    }
  };

  const topComments = comments.filter((c) => !c.parentCommentId);

  return (
    <div className="mt-4 w-full">
      <h3 className="text-lg font-bold mb-2">留言區</h3>
      <div className="space-y-3 max-h-[240px] overflow-y-auto p-2 bg-neutral-800 rounded-md">
        {topComments.length === 0 ? (
          <p className="text-gray-400 text-sm">目前還沒有留言。</p>
        ) : (
          topComments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              allComments={comments}
              currentUser={currentUser}
              onDelete={handleDeleteComment}
              onReply={handleCommentSubmit}
              replyValue={replyInputs[comment._id] || ""}
              onReplyChange={(id, val) => setReplyInputs((prev) => ({ ...prev, [id]: val }))}
              isReplying={replyMap[comment._id] || false}
              toggleReplyInput={(id) =>
                setReplyMap((prev) => ({ ...prev, [id]: !prev[id] }))
              }
              isExpanded={replyExpandMap[comment._id] || false}
              toggleExpand={(id) =>
                setReplyExpandMap((prev) => ({ ...prev, [id]: !prev[id] }))
              }
            />
          ))
        )}
      </div>

      {currentUser ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 rounded bg-neutral-700 text-white p-2 text-sm placeholder-gray-400"
            placeholder="輸入留言..."
          />
          <button
            onClick={() => handleCommentSubmit(null)}
            className="bg-blue-600 px-3 py-2 text-sm rounded hover:bg-blue-700 transition"
          >
            發送
          </button>
        </div>
      ) : (
        <p className="text-sm text-red-400 mt-3">請先登入才能留言喔～</p>
      )}
    </div>
  );
}

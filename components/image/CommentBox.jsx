"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import CommentItem from "./CommentItem";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";

function findCommentById(comments, id) {
  for (const comment of comments) {
    if (comment._id === id) return comment;
    const found = findCommentById(comment.replies || [], id);
    if (found) return found;
  }
  return null;
}

function removeCommentById(comments, id) {
  return comments
    .filter((comment) => comment._id !== id)
    .map((comment) => ({
      ...comment,
      replies: removeCommentById(comment.replies || [], id),
    }));
}

export default function CommentBox({ imageId, onAddComment, currentUser, onlyList = false, onlyInput = false }) {
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

      const newCommentObj = {
        _id: res.data._id,
        text,
        userId: currentUser?._id || "匿名用戶",
        userName: currentUser?.username || "匿名用戶",
        userImage: currentUser?.image || DEFAULT_AVATAR_IDS.hidden,
        createdAt: new Date(),
        parentCommentId: parentCommentId || null,
        parentUserId: res.data.parentUserId || null,
        parentUserName: res.data.parentUserName || null,
        replies: [],
      };

      if (parentCommentId) {
        setComments((prevComments) => {
          const insertReply = (nodes) =>
            nodes.map((node) => {
              if (node._id === parentCommentId) {
                return {
                  ...node,
                  replies: [...(node.replies || []), newCommentObj],
                };
              }
              return {
                ...node,
                replies: insertReply(node.replies || []),
              };
            });
          return insertReply(prevComments);
        });
        setReplyInputs((prev) => ({ ...prev, [parentCommentId]: "" }));
        setReplyMap((prev) => ({ ...prev, [parentCommentId]: false }));
      } else {
        setComments((prevComments) => [...prevComments, newCommentObj]);
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
      const res = await axios.delete(`/api/delete-comment/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 200) {
        setComments((prev) => {
          const updated = removeCommentById(prev, commentId);
          return [...updated];
        });
      }
    } catch (err) {
      const serverMessage = err.response?.data?.message;
      if (serverMessage === "找不到留言" || serverMessage === "無效的 commentId") {
        console.warn("留言已不存在，畫面將同步移除");
        setComments((prev) => {
          const updated = removeCommentById(prev, commentId);
          return [...updated];
        });
      } else {
        console.error("留言刪除錯誤：", err);
        alert(`刪除失敗：${serverMessage || "未知錯誤"}`);
      }
    }
  };

  return (
    <div className="w-full">
      {/* 留言清單 */}
      {!onlyInput && (
        <>
          <h3 className="text-lg font-bold mb-2">留言區</h3>
          <div className="space-y-3 p-2 bg-neutral-800 rounded-md">
            {comments.length === 0 ? (
              <p className="text-gray-400 text-sm">目前還沒有留言。</p>
            ) : (
              comments
                .filter((comment) => comment.parentCommentId === null)
                .map((comment) => (
                  <CommentItem
                    key={comment._id}
                    comment={comment}
                    replies={comment.replies || []}
                    currentUser={currentUser}
                    onDelete={handleDeleteComment}
                    onReply={handleCommentSubmit}
                    replyInputs={replyInputs}
                    onReplyChange={(id, val) =>
                      setReplyInputs((prev) => ({ ...prev, [id]: val }))
                    }
                    replyMap={replyMap}
                    toggleReplyInput={(id) =>
                      setReplyMap((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                    isExpanded={replyExpandMap[comment._id] || false}
                    toggleExpand={(id) =>
                      setReplyExpandMap((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                    depth={0}
                  />
                ))
            )}
          </div>
        </>
      )}

      {/* 輸入欄 */}
      {!onlyList &&
        (currentUser ? (
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
        ))}
    </div>
  );
}

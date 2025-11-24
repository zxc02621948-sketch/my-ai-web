"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import CommentItem from "./CommentItem";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import ReportModal from "@/components/common/ReportModal";
import NotificationModal from "@/components/common/NotificationModal";

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
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyMap, setReplyMap] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [replyExpandMap, setReplyExpandMap] = useState({});
  const [errorMessage, setErrorMessage] = useState("");  // ✅ 新增：本地錯誤提示
  
  // 檢舉彈窗狀態
  const [reportModal, setReportModal] = useState({ isOpen: false, commentId: null, content: '' });
  
  // 通知彈窗狀態
  const [notification, setNotification] = useState({ isOpen: false, type: 'info', title: '', message: '' });

  // ✅ 優化：添加AbortController避免重複調用和內存泄漏
  useEffect(() => {
    if (!imageId) return;
    
    const abortController = new AbortController();
    
    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/comments/${imageId}`, {
          signal: abortController.signal
        });
        // ✅ 檢查請求是否已被取消
        if (!abortController.signal.aborted) {
          setComments(res.data);
        }
      } catch (err) {
        // ✅ 忽略被取消的請求
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || abortController.signal.aborted) {
          return;
        }
        console.error("留言讀取錯誤：", err);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchComments();
    
    // ✅ 清理函數：取消請求
    return () => {
      abortController.abort();
    };
  }, [imageId]);

  const handleCommentSubmit = async (parentCommentId = null) => {
    const text = parentCommentId ? replyInputs[parentCommentId] : newComment;
    if (!text?.trim()) return;

    // 清空之前的錯誤提示
    setErrorMessage("");

    try {
      const res = await axios.post(`/api/comments/${imageId}`, {
        text,
        userId: currentUser?._id || "匿名用戶",
        userName: currentUser?.username || "匿名用戶",
        imageId,
        parentCommentId: typeof parentCommentId === "string" ? parentCommentId : null,
      });

      // 使用 API 返回的完整數據，包含 userFrame
      const newCommentObj = {
        _id: res.data._id,
        text: res.data.text,
        userId: res.data.userId,
        userName: res.data.userName,
        userImage: res.data.userImage,
        userFrame: res.data.userFrame, // 添加 userFrame 字段
        createdAt: res.data.createdAt,
        parentCommentId: res.data.parentCommentId,
        parentUserId: res.data.parentUserId,
        parentUserName: res.data.parentUserName,
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

      window.dispatchEvent(new Event("refreshNotifications"));

    } catch (err) {
      // 顯示本地錯誤提示（在輸入框下方）
      const errMsg = err.response?.data?.error || "留言發送失敗，請稍後再試";
      setErrorMessage(errMsg);
      
      // 3 秒後自動清除錯誤提示
      setTimeout(() => setErrorMessage(""), 3000);
      
      // 只在真正的系統錯誤時才 console.error
      if (!err.response?.data?.error) {
        console.error("留言發送錯誤：", err);
      }
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

  const handleReport = (commentId, commentContent) => {
    if (!currentUser) {
      setNotification({ 
        isOpen: true, 
        type: 'error', 
        title: '請先登入', 
        message: '您需要登入才能檢舉內容' 
      });
      return;
    }
    setReportModal({ isOpen: true, commentId, content: commentContent });
  };

  const submitReport = async (reason) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image_comment',
          targetId: reportModal.commentId,
          reason: reason,
          details: reportModal.content
        })
      });

      const result = await response.json();

      if (result.ok || result.success) {
        setNotification({ 
          isOpen: true, 
          type: 'success', 
          title: '檢舉成功', 
          message: '檢舉已提交，管理員將會審核。感謝你協助維護社群品質！' 
        });
        setReportModal({ isOpen: false, commentId: null, content: '' });
      } else {
        setNotification({ 
          isOpen: true, 
          type: 'error', 
          title: '檢舉失敗', 
          message: result.message || result.error || '檢舉失敗，請稍後再試' 
        });
      }
    } catch (error) {
      console.error('檢舉錯誤:', error);
      setNotification({ 
        isOpen: true, 
        type: 'error', 
        title: '檢舉失敗', 
        message: '網路錯誤，請稍後再試' 
      });
    }
  };

  return (
    <div className="w-full">
      {/* 留言清單 */}
      {!onlyInput && (
        <>
          <h3 className="text-lg font-bold mb-2">留言區</h3>
          <div className="space-y-3 p-2 bg-neutral-800 rounded-md">
            {loading ? (
              <p className="text-gray-400 text-sm">載入留言中...</p>
            ) : comments.length === 0 ? (
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
                    onReport={handleReport}
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
          <div className="mt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  // 用戶輸入時清空錯誤提示
                  if (errorMessage) setErrorMessage("");
                }}
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
            
            {/* 錯誤提示（在輸入框下方） */}
            {errorMessage && (
              <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-400 mt-3">請先登入才能留言喔～</p>
        ))}
      
      {/* 檢舉彈窗 */}
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, commentId: null, content: '' })}
        onSubmit={submitReport}
        title="檢舉留言"
        description="請說明檢舉原因，我們會盡快審核處理"
      />
      
      {/* 通知彈窗 */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
}

 
 
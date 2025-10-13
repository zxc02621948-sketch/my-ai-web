"use client";

import { useState, useEffect } from "react";
import AvatarFrame from "@/components/common/AvatarFrame";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Trash2 } from "lucide-react";

export default function DiscussionCommentBox({ postId, currentUser, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!postId) return;
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discussion/posts/${postId}/comments`);
      const result = await res.json();
      if (result.success) {
        setComments(result.data);
        onCommentCountChange?.(result.data.length);
      }
    } catch (err) {
      console.error("載入評論失敗:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      alert('請先登入');
      return;
    }
    
    if (!newComment.trim()) {
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/discussion/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setComments([result.data, ...comments]);
        setNewComment('');
        onCommentCountChange?.(comments.length + 1);
      } else {
        alert(result.error || '評論失敗');
      }
    } catch (error) {
      console.error('評論錯誤:', error);
      alert('評論失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('確定要刪除此評論嗎？')) return;
    
    try {
      const response = await fetch(`/api/discussion/comments/${commentId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setComments(comments.filter(c => c._id !== commentId));
        onCommentCountChange?.(Math.max(0, comments.length - 1));
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      alert('刪除失敗');
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diff = Math.floor((now - commentDate) / 1000);
    
    if (diff < 60) return '剛剛';
    if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return commentDate.toLocaleDateString('zh-TW');
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold mb-4">💬 評論 ({comments.length})</h3>
      
      {/* 發表評論 */}
      {currentUser ? (
        <div className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="發表你的看法..."
            className="w-full bg-zinc-800 text-white rounded-lg p-3 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '發送中...' : '發送評論'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-zinc-800 rounded-lg text-center">
          <p className="text-gray-400">請先登入才能發表評論</p>
        </div>
      )}
      
      {/* 評論列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">載入評論中...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            還沒有評論，來發表第一個吧！
          </div>
        ) : (
          comments.map(comment => {
            // 使用 image 字段（與圖卡評論一致）
            const rawImage = comment.author?.image;
            const avatarId = (rawImage && rawImage.trim()) ? rawImage : DEFAULT_AVATAR_IDS.male;
            const avatarUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${avatarId}/avatar`;
            const frameId = comment.author?.currentFrame || 'default';
            
            const isCommentAuthor = currentUser?._id === comment.author?._id || 
                                   currentUser?._id === comment.author?.toString();
            const canDelete = isCommentAuthor || currentUser?.role === 'admin';
            
            return (
              <div key={comment._id} className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {/* 使用 AvatarFrame 組件 */}
                  <AvatarFrame
                    src={avatarUrl}
                    size={40}
                    frameId={frameId}
                    showFrame={true}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{comment.authorName}</span>
                      <span className="text-xs text-gray-500">{formatTime(comment.createdAt)}</span>
                      
                      {/* 刪除按鈕 */}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(comment._id)}
                          className="ml-auto p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="刪除評論"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


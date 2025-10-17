"use client";

import { useState, useEffect, useRef } from "react";
import AvatarFrame from "@/components/common/AvatarFrame";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Trash2, Reply, Flag } from "lucide-react";
import ReportModal from "@/components/common/ReportModal";
import NotificationModal from "@/components/common/NotificationModal";

export default function DiscussionCommentBox({ postId, currentUser, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // 回覆對象 {id, name}
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionUsers, setMentionUsers] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  
  // 檢舉彈窗狀態
  const [reportModal, setReportModal] = useState({ isOpen: false, commentId: null, content: '' });
  
  // 通知彈窗狀態
  const [notification, setNotification] = useState({ isOpen: false, type: 'info', title: '', message: '' });

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

  // 處理輸入變化，檢測 @ 標註
  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setNewComment(value);
    setCursorPosition(cursor);

    // 檢測 @ 符號
    const textBeforeCursor = value.substring(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setShowMentionMenu(true);
      searchUsers(atMatch[1]);
    } else {
      setShowMentionMenu(false);
    }
  };

  // 搜尋用戶
  const searchUsers = async (query) => {
    try {
      // 從評論中獲取所有用戶
      const uniqueUsers = new Map();
      comments.forEach(comment => {
        if (comment.author && comment.authorName) {
          const userId = comment.author._id || comment.author;
          if (!uniqueUsers.has(userId)) {
            uniqueUsers.set(userId, {
              id: userId,
              name: comment.authorName,
              image: comment.author?.image
            });
          }
        }
      });

      const users = Array.from(uniqueUsers.values());
      
      // 過濾用戶
      if (query) {
        setMentionUsers(users.filter(u => 
          u.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5));
      } else {
        setMentionUsers(users.slice(0, 5));
      }
    } catch (err) {
      console.error("搜尋用戶失敗:", err);
    }
  };

  // 插入提及
  const insertMention = (user) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const textBeforeAt = textBeforeCursor.replace(/@\w*$/, '');
    const newText = `${textBeforeAt}@${user.name} ${textAfterCursor}`;
    
    setNewComment(newText);
    setShowMentionMenu(false);
    
    // 設置焦點回textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = textBeforeAt.length + user.name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  // 點擊回覆按鈕
  const handleReplyClick = (comment) => {
    setReplyTo({
      id: comment.author._id || comment.author,
      name: comment.authorName
    });
    setNewComment(`@${comment.authorName} `);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // 取消回覆
  const cancelReply = () => {
    setReplyTo(null);
    setNewComment("");
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
      // 提取所有 @ 提及
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;
      
      while ((match = mentionRegex.exec(newComment)) !== null) {
        const mentionedName = match[1];
        // 查找對應的用戶
        const uniqueUsers = new Map();
        comments.forEach(comment => {
          if (comment.author && comment.authorName) {
            const userId = comment.author._id || comment.author;
            uniqueUsers.set(comment.authorName, userId);
          }
        });
        
        if (uniqueUsers.has(mentionedName)) {
          mentions.push({
            userId: uniqueUsers.get(mentionedName),
            username: mentionedName
          });
        }
      }

      const response = await fetch(`/api/discussion/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: newComment.trim(),
          mentions: mentions, // 發送提及信息
          replyTo: replyTo?.id || null
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setComments([result.data, ...comments]);
        setNewComment('');
        setReplyTo(null);
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

  const handleReport = (commentId, commentContent) => {
    if (!currentUser) {
      setNotification({ isOpen: true, type: 'error', title: '請先登入', message: '您需要登入才能檢舉內容' });
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
          type: 'discussion_comment',
          targetId: reportModal.commentId,
          reason: reason,
          details: reportModal.content
        })
      });

      const result = await response.json();

      if (result.ok || result.success) {
        setNotification({ isOpen: true, type: 'success', title: '檢舉成功', message: '檢舉已提交，管理員將會審核' });
      } else {
        setNotification({ isOpen: true, type: 'error', title: '檢舉失敗', message: result.message || result.error || '檢舉失敗，請稍後再試' });
      }
    } catch (error) {
      console.error('檢舉錯誤:', error);
      setNotification({ isOpen: true, type: 'error', title: '檢舉失敗', message: '網路錯誤，請稍後再試' });
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
        <div className="mb-6 relative">
          {/* 回覆提示 */}
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 text-sm text-blue-400">
              <Reply className="w-4 h-4" />
              <span>回覆 @{replyTo.name}</span>
              <button 
                onClick={cancelReply}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
          
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleCommentChange}
            placeholder="發表你的看法... (輸入 @ 可以標註用戶)"
            className="w-full bg-zinc-800 text-white rounded-lg p-3 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
          
          {/* @ 提及選單 */}
          {showMentionMenu && mentionUsers.length > 0 && (
            <div className="absolute z-10 mt-1 bg-zinc-700 rounded-lg shadow-lg border border-zinc-600 max-h-48 overflow-y-auto">
              {mentionUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className="w-full px-4 py-2 text-left hover:bg-zinc-600 flex items-center gap-2 transition-colors"
                >
                  <span className="text-white">{user.name}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-gray-500">
              提示：輸入 @ 可標註其他用戶
            </div>
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
                      
                      <div className="ml-auto flex items-center gap-1">
                        {/* 回覆按鈕 */}
                        {currentUser && (
                          <button
                            onClick={() => handleReplyClick(comment)}
                            className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                            title="回覆"
                          >
                            <Reply className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* 檢舉按鈕 */}
                        {currentUser && !isCommentAuthor && (
                          <button
                            onClick={() => handleReport(comment._id, comment.content)}
                            className="p-1 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10 rounded transition-colors"
                            title="檢舉"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* 刪除按鈕 */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(comment._id)}
                            className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="刪除評論"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* 渲染內容，高亮 @ 提及 */}
                    <div className="text-gray-300 whitespace-pre-wrap">
                      {comment.content.split(/(@\w+)/g).map((part, i) => {
                        if (part.match(/^@\w+$/)) {
                          return (
                            <span key={i} className="text-blue-400 font-medium">
                              {part}
                            </span>
                          );
                        }
                        return part;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 檢舉彈窗 */}
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, commentId: null, content: '' })}
        onSubmit={submitReport}
        title="檢舉評論"
        description="請詳細說明您檢舉此評論的原因，以便管理員審核處理。"
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


"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Bookmark, Share2, Trash2, Flag, Pin, PinOff, Edit } from "lucide-react";
import Link from "next/link";
import ImageModal from "@/components/image/ImageModal";
import DiscussionCommentBox from "@/components/discussion/DiscussionCommentBox";
import AuthorCard from "@/components/discussion/AuthorCard";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import ReportModal from "@/components/common/ReportModal";
import NotificationModal from "@/components/common/NotificationModal";
import { notify } from "@/components/common/GlobalNotificationManager";
import BackToTopButton from "@/components/common/BackToTopButton";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useCurrentUser(); // 使用 Context
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // 檢舉彈窗狀態
  const [reportModal, setReportModal] = useState({ isOpen: false });
  
  // 通知彈窗狀態
  const [notification, setNotification] = useState({ isOpen: false, type: 'info', title: '', message: '' });

  const categories = [
    { id: "announcement", name: "官方公告", icon: "📢" },
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

  const handleAnchorClick = (event, href) => {
    if (!href || !href.startsWith('#')) return;
    event.preventDefault();
    const decodedId = decodeURIComponent(href.slice(1));
    let targetElement = document.getElementById(decodedId);

    // 如果找不到，嘗試匹配目錄自動生成的 heading-{index}- 標識
    if (!targetElement && decodedId.startsWith('heading-')) {
      const match = decodedId.match(/^heading-(\d+)-/);
      if (match) {
        const targetIndex = Number(match[1]);
        const allHeadings = document.querySelectorAll('.markdown-content h1, .markdown-content h2, .markdown-content h3');
        if (allHeadings[targetIndex]) {
          allHeadings[targetIndex].id = decodedId;
          targetElement = allHeadings[targetIndex];
        }
      }
    }

    // 再次嘗試匹配手動插入的 <a id="..."></a>
    if (!targetElement) {
      targetElement = document.querySelector(`a[id="${decodedId}"]`);
    }

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // currentUser 由 CurrentUserContext 提供，無需額外獲取

  // 獲取帖子詳情
  useEffect(() => {
    if (!params.id) return;
    
    setLoading(true);
    fetch(`/api/discussion/posts/${params.id}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setPost(result.data);
        } else {
          notify.error("載入失敗", result.error || "請稍後再試");
          router.push('/discussion');
        }
      })
      .catch(err => {
        console.error('載入失敗:', err);
        router.push('/discussion');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id, router]);

  const formatTime = (date) => {
    const now = new Date();
    const postDate = new Date(date);
    const diff = Math.floor((now - postDate) / 1000);
    
    if (diff < 60) return '剛剛';
    if (diff < 3600) return `${Math.floor(diff / 60)}分鐘前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小時前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return postDate.toLocaleDateString('zh-TW');
  };

  const handleLike = async () => {
    if (!currentUser) {
      notify.warning("提示", "請先登入");
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${params.id}/like`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPost(result.data);
      }
    } catch (error) {
      console.error('點讚錯誤:', error);
    }
  };

  const handleBookmark = async () => {
    if (!currentUser) {
      notify.warning("提示", "請先登入");
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${params.id}/bookmark`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPost(result.data);
      }
    } catch (error) {
      console.error('收藏錯誤:', error);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      notify.success("成功", "鏈接已複製到剪貼板！");
    } catch (error) {
      notify.error("複製失敗", "請稍後再試");
    }
  };

  const handleDelete = async () => {
    const confirmed = await notify.confirm("確認刪除", "確定要刪除此帖子嗎？");
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/discussion/posts/${params.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        notify.success("成功", "帖子已刪除");
        router.push('/discussion');
      } else {
        notify.error("刪除失敗", result.error || "請稍後再試");
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      notify.error("刪除失敗", "請稍後再試");
    }
  };

  const handleReport = () => {
    if (!currentUser) {
      setNotification({ isOpen: true, type: 'error', title: '請先登入', message: '您需要登入才能檢舉內容' });
      return;
    }
    setReportModal({ isOpen: true });
  };

  const submitReport = async (reason) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'discussion_post',
          targetId: post._id,
          reason: reason,
          details: post.title
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

  // 置頂/取消置頂
  const handlePin = async () => {
    try {
      const action = post.isPinned ? 'unpin' : 'pin';
      const response = await fetch(`/api/discussion/posts/${post._id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const result = await response.json();

      if (result.success) {
        setPost({ ...post, isPinned: result.isPinned });
        setNotification({ 
          isOpen: true, 
          type: 'success', 
          title: result.isPinned ? '已置頂' : '已取消置頂', 
          message: result.message 
        });
      } else {
        setNotification({ isOpen: true, type: 'error', title: '操作失敗', message: result.error || '操作失敗' });
      }
    } catch (error) {
      console.error('置頂錯誤:', error);
      setNotification({ isOpen: true, type: 'error', title: '操作失敗', message: '網路錯誤，請稍後再試' });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">帖子不存在</h2>
          <Link href="/discussion" className="text-blue-500 hover:underline">返回討論區</Link>
        </div>
      </div>
    );
  }

  const imageUrl = post.imageRef?.imageId 
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${post.imageRef.imageId}/public`
    : post.uploadedImage?.url;

  const isAuthor = currentUser?._id === post.author?._id || currentUser?._id === post.author?.toString();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  
  // 調試信息
  console.log('🔧 [討論區] 權限檢查:', {
    currentUser: currentUser,
    role: currentUser?.role,
    isAdmin: currentUser?.isAdmin,
    isAdminResult: isAdmin,
    isAuthorResult: isAuthor
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 頁面頭部 */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/discussion"
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">帖子詳情</h1>
          </div>
        </div>
      </div>

      {/* 帖子內容 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-zinc-900 rounded-xl p-6">
          {/* 分類和操作 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-zinc-700 text-sm rounded-full">
                {categories.find(cat => cat.id === post.category)?.icon} 
                {categories.find(cat => cat.id === post.category)?.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* 置頂按鈕（僅管理員可見） */}
              {isAdmin && (
                <button
                  onClick={handlePin}
                  className={`p-2 rounded transition-colors ${
                    post.isPinned 
                      ? 'text-amber-500 bg-amber-500/20 hover:bg-amber-500/30' 
                      : 'text-gray-500 hover:text-amber-500 hover:bg-amber-500/10'
                  }`}
                  title={post.isPinned ? "取消置頂" : "置頂帖子"}
                >
                  {post.isPinned ? <PinOff className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                </button>
              )}
              
              {/* 編輯按鈕 */}
              {(isAuthor || isAdmin) && (
                <Link
                  href={`/discussion/${post._id}/edit`}
                  className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                  title="編輯帖子"
                >
                  <Edit className="w-5 h-5" />
                </Link>
              )}
              
              {/* 檢舉按鈕 */}
              {currentUser && !isAuthor && (
                <button
                  onClick={handleReport}
                  className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10 rounded transition-colors"
                  title="檢舉帖子"
                >
                  <Flag className="w-5 h-5" />
                </button>
              )}
              
              {/* 刪除按鈕 */}
              {(isAuthor || isAdmin) && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="刪除帖子"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* 標題 */}
          <div className="flex items-center gap-3 mb-4">
            {post.isPinned && (
              <span className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-500 text-sm rounded-full font-semibold flex-shrink-0">
                <Pin className="w-4 h-4" />
                置頂
              </span>
            )}
            <h1 className="text-3xl font-bold">{post.title}</h1>
          </div>

          {/* 作者和時間 */}
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
            <span>作者：{post.authorName || post.author?.username}</span>
            <span>•</span>
            <span>{formatTime(post.createdAt)}</span>
            <span>•</span>
            <span>👁️ {post.viewCount || 0} 次瀏覽</span>
          </div>

          {/* 作者名片 */}
          {post.author && (
            <div className="mb-6">
              <AuthorCard author={post.author} compact={false} />
            </div>
          )}

          {/* 引用圖片 */}
          {post.imageRef && (
            <div className="mb-6 flex flex-col items-center">
              <img
                src={imageUrl}
                alt={post.imageRef.title || '帖子圖片'}
                className="rounded-lg border border-zinc-700"
                style={{ maxWidth: '800px' }}
              />
              <p className="text-sm text-gray-400 mt-2 text-center">
                引用圖片：
                <span 
                  className="text-blue-400 hover:underline cursor-pointer ml-1"
                  onClick={() => setSelectedImage(post.imageRef._id)}
                >
                  {post.imageRef.title}
                </span>
              </p>
            </div>
          )}
          
          {/* 上傳圖片（非引用） */}
          {!post.imageRef && post.uploadedImage && (
            <div className="mb-6 flex flex-col items-center">
              <img
                src={post.uploadedImage.url}
                alt="帖子圖片"
                className="rounded-lg border border-zinc-700"
                style={{ maxWidth: '800px' }}
              />
            </div>
          )}

          {/* 多圖教學帖統計（僅作者可見） - 簡化版，只顯示數據 */}
          {post.imageCount >= 2 && post.author?._id === currentUser?._id && (
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  📚 多圖教學 · {post.likesCount} 個愛心 · 消耗 {post.pointsCost} 積分
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {(post.pendingPoints || 0) > 0 && (
                    <div className="text-yellow-400">
                      待領取 +{post.pendingPoints}
                    </div>
                  )}
                  {(post.claimedPoints || 0) > 0 && (
                    <div className="text-green-400">
                      已領取 +{post.claimedPoints}
                    </div>
                  )}
                  {(post.pendingPoints || 0) > 0 && (
                    <div className="text-blue-400">
                      → 前往個人頁面提領
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 內容 - 支持 {{image:N}} 插入 + Markdown/HTML 渲染 */}
          <div className="prose prose-invert max-w-none mb-6">
            {(() => {
              const content = post.content || '';
              const parts = content.split(/({{image:\d+}})/g);
              
              return parts.map((part, index) => {
                const match = part.match(/{{image:(\d+)}}/);
                if (match) {
                  const imageIndex = parseInt(match[1]);
                  const image = post.uploadedImages?.[imageIndex];
                  
                  if (image) {
                    return (
                      <div key={index} className="my-6 flex flex-col items-center">
                        <img
                          src={image.url}
                          alt={`圖片 ${imageIndex}`}
                          className="rounded-lg border border-zinc-700"
                          style={{ maxWidth: '800px' }}
                        />
                        <p className="text-sm text-gray-500 mt-2">圖片 {imageIndex}</p>
                      </div>
                    );
                  } else {
                    return (
                      <div key={index} className="my-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                        ⚠️ 圖片 {imageIndex} 不存在
                      </div>
                    );
                  }
                }
                
                // 如果内容为空，不渲染
                if (!part.trim()) {
                  return null;
                }
                
                // 使用 ReactMarkdown 渲染 Markdown/HTML
                return (
                  <div key={index} className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSlug]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a 
                            {...props} 
                            className="text-blue-400 hover:text-blue-300 underline"
                            onClick={(e) => handleAnchorClick(e, props.href)}
                          />
                        ),
                        h1: ({ node, ...props }) => (
                          <h1
                            {...props}
                            className={`text-3xl font-bold mt-8 mb-4 text-white border-b border-zinc-700 pb-2 ${props.className || ''}`}
                          />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2
                            {...props}
                            className={`text-2xl font-bold mt-6 mb-3 text-white border-b border-zinc-700 pb-2 ${props.className || ''}`}
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3
                            {...props}
                            className={`text-xl font-bold mt-5 mb-2 text-white ${props.className || ''}`}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p {...props} className="text-gray-300 mb-4 leading-relaxed" />
                        ),
                        code: ({ node, inline, ...props }) => {
                          if (inline) {
                            return (
                              <code {...props} className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-pink-300 font-mono" />
                            );
                          }
                          return (
                            <code {...props} className="block bg-zinc-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-200 font-mono" />
                          );
                        },
                        pre: ({ node, ...props }) => (
                          <pre {...props} className="bg-zinc-900 p-4 rounded-lg overflow-x-auto my-4" />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul {...props} className="list-disc list-inside mb-4 text-gray-300 space-y-1" />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol {...props} className="list-decimal list-inside mb-4 text-gray-300 space-y-1" />
                        ),
                        li: ({ node, ...props }) => (
                          <li {...props} className="ml-4" />
                        ),
                        blockquote: ({ node, ...props }) => (
                          <blockquote {...props} className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-400" />
                        ),
                        img: ({ node, ...props }) => (
                          <img {...props} className="max-w-full rounded-lg my-4" />
                        ),
                      }}
                    >
                      {part}
                    </ReactMarkdown>
                  </div>
                );
              });
            })()}
          </div>

          {/* 互動按鈕 */}
          <div className="flex items-center gap-6 pt-6 border-t border-zinc-800">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                post.likes?.includes(currentUser?._id) 
                  ? 'bg-red-500/20 text-red-500' 
                  : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
              }`}
            >
              <Heart className={`w-5 h-5 ${post.likes?.includes(currentUser?._id) ? 'fill-current' : ''}`} />
              <span>{post.likesCount || 0}</span>
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-gray-400 rounded-lg hover:bg-zinc-700 transition-colors"
              title="查看評論"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{post.commentsCount || 0}</span>
            </button>
            <button 
              onClick={handleBookmark}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                post.isBookmarkedByCurrentUser 
                  ? 'bg-yellow-500/20 text-yellow-500' 
                  : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${post.isBookmarkedByCurrentUser ? 'fill-current' : ''}`} />
              <span>{post.isBookmarkedByCurrentUser ? '已收藏' : '收藏'}</span>
            </button>
            <button 
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-gray-400 rounded-lg hover:bg-zinc-700 transition-colors"
              title="分享鏈接"
            >
              <Share2 className="w-5 h-5" />
              <span>分享</span>
            </button>
          </div>

          {/* 評論區 - 使用 DiscussionCommentBox 組件 */}
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <DiscussionCommentBox
              postId={params.id}
              currentUser={currentUser}
              onCommentCountChange={(count) => {
                setPost(prev => ({
                  ...prev,
                  commentsCount: count
                }));
              }}
            />
          </div>
        </div>
      </div>

      {/* ImageModal - 點擊引用圖片時打開 */}
      <BackToTopButton />

      {selectedImage && (
        <ImageModal
          imageId={selectedImage}
          currentUser={currentUser}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* 檢舉彈窗 */}
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false })}
        onSubmit={submitReport}
        title="檢舉帖子"
        description="請詳細說明您檢舉此帖子的原因，以便管理員審核處理。"
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


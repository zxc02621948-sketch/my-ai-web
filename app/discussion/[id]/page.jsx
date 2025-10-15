"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Bookmark, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import ImageModal from "@/components/image/ImageModal";
import DiscussionCommentBox from "@/components/discussion/DiscussionCommentBox";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useCurrentUser(); // 使用 Context
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const categories = [
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

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
          alert(result.error || '載入失敗');
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
      alert('請先登入');
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
      alert('請先登入');
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
      alert('鏈接已複製到剪貼板！');
    } catch (error) {
      alert('複製失敗');
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除此帖子嗎？')) return;
    
    try {
      const response = await fetch(`/api/discussion/posts/${params.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('帖子已刪除');
        router.push('/discussion');
      } else {
        alert(result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      alert('刪除失敗');
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
  const isAdmin = currentUser?.role === 'admin';

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

          {/* 標題 */}
          <h1 className="text-3xl font-bold mb-4">{post.title}</h1>

          {/* 作者和時間 */}
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-6">
            <span>作者：{post.authorName || post.author?.username}</span>
            <span>•</span>
            <span>{formatTime(post.createdAt)}</span>
            <span>•</span>
            <span>👁️ {post.viewCount || 0} 次瀏覽</span>
          </div>

          {/* 引用圖片 */}
          {post.imageRef && (
            <div className="mb-6">
              <img
                src={imageUrl}
                alt={post.imageRef.title || '帖子圖片'}
                className="max-w-full rounded-lg border border-zinc-700 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImage(post.imageRef._id)}
              />
              <p className="text-sm text-gray-400 mt-2">
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
            <div className="mb-6">
              <img
                src={post.uploadedImage.url}
                alt="帖子圖片"
                className="max-w-full rounded-lg border border-zinc-700"
              />
              <p className="text-sm text-gray-400 mt-2">上傳圖片</p>
            </div>
          )}

          {/* 內容 */}
          <div className="prose prose-invert max-w-none mb-6">
            <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
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
                post.bookmarks?.includes(currentUser?._id) 
                  ? 'bg-yellow-500/20 text-yellow-500' 
                  : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${post.bookmarks?.includes(currentUser?._id) ? 'fill-current' : ''}`} />
              <span>{post.bookmarksCount || 0}</span>
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
      {selectedImage && (
        <ImageModal
          imageId={selectedImage}
          currentUser={currentUser}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}


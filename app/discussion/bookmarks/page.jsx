"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Bookmark, Pin } from "lucide-react";
import Link from "next/link";

import ImageModal from "@/components/image/ImageModal";
import AvatarFrame from "@/components/common/AvatarFrame";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function BookmarksPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const categories = [
    { id: "announcement", name: "官方公告", icon: "📢" },
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

  // 載入收藏列表
  useEffect(() => {
    if (!currentUser) {
      router.push('/discussion');
      return;
    }

    const fetchBookmarks = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/discussion/bookmarks');
        const result = await response.json();
        
        if (result.success && result.data) {
          setPosts(result.data);
        } else {
          console.error('載入收藏失敗:', result.error);
          setPosts([]);
        }
      } catch (error) {
        console.error('載入收藏錯誤:', error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookmarks();
  }, [currentUser, router]);

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

  const handleBookmark = async (postId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser) {
      notify.warning("提示", "請先登入");
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${postId}/bookmark`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 從列表中移除已取消收藏的帖子
        setPosts(prev => prev.filter(post => post._id !== postId));
      }
    } catch (error) {
      console.error('取消收藏錯誤:', error);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      {/* 頭部 */}
      <div className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/discussion')}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bookmark size={28} className="text-yellow-400" />
                我的收藏
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                共 {posts.length} 篇收藏
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 內容區 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-400">載入中...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-xl text-gray-400 mb-2">還沒有收藏任何帖子</p>
            <p className="text-sm text-gray-500 mb-6">
              在討論區瀏覽時，點擊書籤圖標即可收藏
            </p>
            <Link
              href="/discussion"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              前往討論區
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const category = categories.find(c => c.id === post.category);
              const isLiked = currentUser && post.likes?.includes(currentUser._id);
              const isPinned = post.isPinned;
              
              return (
                <div
                  key={post._id}
                  className="block bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 transition-all hover:border-zinc-700 cursor-pointer"
                  onClick={() => router.push(`/discussion/${post._id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* 頭像 */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/user/${post.author._id}`);
                      }}
                      className="flex-shrink-0 cursor-pointer"
                    >
                      <AvatarFrame
                        src={post.author.image}
                        size={48}
                        userId={post.author._id}
                        frameId={post.author.currentFrame || "default"}
                        showFrame={true}
                        frameColor={post.author.frameSettings?.[post.author.currentFrame || "default"]?.color || "#ffffff"}
                        frameOpacity={post.author.frameSettings?.[post.author.currentFrame || "default"]?.opacity || 1}
                        layerOrder={post.author.frameSettings?.[post.author.currentFrame || "default"]?.layerOrder || "frame-on-top"}
                        frameTransparency={post.author.frameSettings?.[post.author.currentFrame || "default"]?.frameOpacity || 1}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 標題與置頂標籤 */}
                      <div className="flex items-start gap-2 mb-2">
                        {isPinned && (
                          <span className="flex-shrink-0 px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded-md border border-red-600/30 flex items-center gap-1">
                            <Pin size={12} className="fill-current" />
                            置頂
                          </span>
                        )}
                        <h3 className="text-lg font-semibold hover:text-blue-400 transition-colors flex-1">
                          {post.title}
                        </h3>
                      </div>

                      {/* 帖子信息 */}
                      <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
                        <span className="hover:text-blue-400 transition-colors">
                          {post.author.username}
                        </span>
                        <span>•</span>
                        <span>{formatTime(post.createdAt)}</span>
                        {category && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {category.icon} {category.name}
                            </span>
                          </>
                        )}
                      </div>

                      {/* 內容預覽 */}
                      <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                        {post.content}
                      </p>

                      {/* 關聯圖片預覽 */}
                      {post.imageRef && (
                        <div 
                          className="relative w-32 h-32 rounded-lg overflow-hidden mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedImage(post.imageRef);
                          }}
                        >
                          <img
                            src={post.imageRef.imageUrl || '/placeholder.png'}
                            alt={post.imageRef.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* 操作欄 */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-400">
                          <Heart 
                            size={16} 
                            className={isLiked ? "fill-pink-500 text-pink-500" : ""}
                          />
                          <span>{post.likes?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <MessageCircle size={16} />
                          <span>{post.commentsCount || 0}</span>
                        </div>
                        <button
                          onClick={(e) => handleBookmark(post._id, e)}
                          className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors ml-auto"
                        >
                          <Bookmark size={16} className="fill-current" />
                          <span>已收藏</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 圖片彈窗 */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}


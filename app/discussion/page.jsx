"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Search, Filter, Heart, MessageCircle, Bookmark, Share2, Trash2, Pin, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import BackToTopButton from "@/components/common/BackToTopButton";

import ImageModal from "@/components/image/ImageModal";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function DiscussionPage() {
  const { currentUser } = useCurrentUser(); // 使用 Context
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("general"); // "general" 或 "adult"
  const [selectedImage, setSelectedImage] = useState(null);
  
  // 防止重複調用
  const lastFetchParamsRef = useRef(null);

  const categories = [
    { id: "all", name: "全部", icon: "📋" },
    { id: "announcement", name: "官方公告", icon: "📢" },
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

  const getTextPreview = (html, maxLength = 200) => {
    if (!html) return "";
    let text = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      // 將換行標籤轉換為換行符
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      // 移除其他 HTML 標籤
      .replace(/<[^>]+>/g, "")
      // 解碼 HTML 實體
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      // 清理多餘的空白字符，但保留換行
      .replace(/[ \t]+/g, " ")  // 多個空格/製表符合併為一個空格
      .replace(/[ \t]*\n[ \t]*/g, "\n")  // 清理換行符前後的空白
      .replace(/\n{3,}/g, "\n\n")  // 多個換行符合併為兩個
      .trim();
    
    if (text.length <= maxLength) return text;
    // 在截斷時，盡量在換行符或空格處截斷
    let truncated = text.slice(0, maxLength);
    const lastNewline = truncated.lastIndexOf("\n");
    const lastSpace = truncated.lastIndexOf(" ");
    // 優先在換行符處截斷，其次在空格處
    if (lastNewline > maxLength * 0.7) {
      truncated = truncated.slice(0, lastNewline);
    } else if (lastSpace > maxLength * 0.7) {
      truncated = truncated.slice(0, lastSpace);
    }
    return `${truncated}...`;
  };

  // 合併數據載入邏輯，避免重複調用
  useEffect(() => {
    const currentParams = JSON.stringify({ 
      category: selectedCategory, 
      search: searchQuery,
      activeTab: activeTab
    });
    
    
    // 參數相同時跳過（但第一次載入除外）
    if (lastFetchParamsRef.current === currentParams && lastFetchParamsRef.current !== null) {
      return;
    }
    
    lastFetchParamsRef.current = currentParams;
    
    // 搜索延遲
    if (searchQuery.length > 0 && searchQuery.length < 2) {
      return; // 搜索字數不足，跳過
    }
    
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          limit: "20",
          category: selectedCategory,
          sort: "newest"
        });
        
        if (searchQuery) {
          params.append("search", searchQuery);
        }
        
        // 根據當前標籤過濾內容
        if (activeTab === "adult") {
          params.append("rating", "18");
        } else {
          params.append("excludeRating", "18");
        }
        
        const response = await fetch(`/api/discussion/posts?${params}`);
        const result = await response.json();
        
        
        if (result.success && result.data) {
          setPosts(result.data);
        } else {
          console.error('❌ [討論區] 載入失敗:', result.error);
          setPosts([]);
        }
      } catch (error) {
        console.error('❌ [討論區] 載入錯誤:', error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    
    // 直接執行，不使用 setTimeout，避免 Strict Mode 清理問題
    fetchPosts();
  }, [selectedCategory, searchQuery, activeTab]);

  // 監聽頁面可見性變化，當頁面重新獲得焦點時重新載入
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && posts.length === 0) {
        // 觸發重新載入：清空 lastFetchParamsRef 並重新設置參數
        lastFetchParamsRef.current = null;
        setSelectedCategory(prev => prev); // 觸發重新渲染
      }
    };

    const handleFocus = () => {
      if (posts.length === 0) {
        // 觸發重新載入：清空 lastFetchParamsRef 並重新設置參數
        lastFetchParamsRef.current = null;
        setSelectedCategory(prev => prev); // 觸發重新渲染
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [posts.length]);

  // 客戶端過濾已由 API 處理，這裡直接使用 posts
  const filteredPosts = posts;

  // 刪除帖子
  const handleDelete = async (postId) => {
    const confirmed = await notify.confirm("確認刪除", "確定要刪除此帖子嗎？");
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/discussion/posts/${postId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 從列表中移除
        setPosts(posts.filter(p => p._id !== postId));
      } else {
        notify.error("刪除失敗", result.error || '刪除失敗');
      }
    } catch (error) {
      console.error('❌ [討論區] 刪除錯誤:', error);
      notify.error("刪除失敗", '刪除失敗，請稍後再試');
    }
  };

  // 點讚
  const handleLike = async (postId) => {
    if (!currentUser) {
      notify.warning("提示", '請先登入');
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${postId}/like`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新帖子數據
        setPosts(posts.map(p => p._id === postId ? result.data : p));
      } else {
        notify.error("操作失敗", result.error || '操作失敗');
      }
    } catch (error) {
      console.error('❌ [討論區] 點讚錯誤:', error);
      notify.error("操作失敗", '操作失敗，請稍後再試');
    }
  };

  // 收藏
  const handleBookmark = async (postId) => {
    if (!currentUser) {
      notify.warning("提示", '請先登入');
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${postId}/bookmark`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 更新帖子數據
        setPosts(posts.map(p => p._id === postId ? result.data : p));
      } else {
        notify.error("操作失敗", result.error || '操作失敗');
      }
    } catch (error) {
      console.error('❌ [討論區] 收藏錯誤:', error);
      notify.error("操作失敗", '操作失敗，請稍後再試');
    }
  };

  // 調整置頂順序
  const handlePinOrder = async (postId, direction) => {
    if (!currentUser || (currentUser.role !== 'admin' && !currentUser.isAdmin)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/discussion/posts/${postId}/pin-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 清除緩存，強制重新載入
        lastFetchParamsRef.current = null;
        
        // 重新載入帖子列表以反映新順序
        const fetchPosts = async () => {
          try {
            const params = new URLSearchParams({
              page: "1",
              limit: "20",
              category: selectedCategory,
              sort: "newest"
            });
            
            if (searchQuery) {
              params.append("search", searchQuery);
            }
            
            // 根據當前標籤過濾內容
            if (activeTab === "adult") {
              params.append("rating", "18");
            } else {
              params.append("excludeRating", "18");
            }
            
            // 添加時間戳強制刷新
            params.append('_t', Date.now().toString());
            
            const res = await fetch(`/api/discussion/posts?${params}`);
            const data = await res.json();
            
            if (data.success && data.data) {
              setPosts(data.data);
            } else {
              console.error('載入帖子失敗:', data.error);
              setPosts([]);
            }
          } catch (error) {
            console.error('載入帖子失敗:', error);
            setPosts([]);
          }
        };
        
        await fetchPosts();
        // 稍微延遲一下，確保數據已更新
        setTimeout(() => {
          notify.success("成功", result.message || '順序已更新');
        }, 100);
      } else {
        notify.error("操作失敗", result.error || '操作失敗');
      }
    } catch (error) {
      console.error('❌ [討論區] 調整順序錯誤:', error);
      notify.error("操作失敗", '操作失敗，請稍後再試');
    }
  };

  // 分享（複製鏈接）
  const handleShare = async (postId) => {
    const url = `${window.location.origin}/discussion/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      notify.success("複製成功", '鏈接已複製到剪貼板！');
    } catch (error) {
      console.error('❌ [討論區] 複製失敗:', error);
      notify.error("複製失敗", '複製失敗，請手動複製');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 页面头部 */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">討論區</h1>
              <p className="text-gray-400">分享創作心得，交流技術經驗</p>
            </div>
            <div className="flex items-center gap-3">
              {currentUser && (
                <Link
                  href="/discussion/bookmarks"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700
                             text-white font-semibold rounded-xl transition-all border border-zinc-700"
                >
                  <Bookmark className="w-4 h-4" />
                  我的收藏
                </Link>
              )}
              <Link
                href={`/discussion/create${activeTab === "adult" ? "?zone=adult" : ""}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 
                           text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                發佈帖子
              </Link>
            </div>
          </div>

          {/* 標籤切換 - 類似首頁的作品展示/作品參考 */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setActiveTab("general")}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                activeTab === "general"
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                  : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
              }`}
            >
              💬 一般討論區
            </button>
            <button
              onClick={() => setActiveTab("adult")}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                activeTab === "adult"
                  ? "bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg"
                  : "bg-zinc-800 text-gray-400 hover:bg-zinc-700"
              }`}
            >
              🔞 18+ 討論區
            </button>
          </div>

          {/* 搜索和筛选 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索帖子標題、內容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg 
                           text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post, index) => {
              // 處理圖片 URL
              const imageUrl = post.imageRef?.imageId 
                ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${post.imageRef.imageId}/public`
                : post.uploadedImage?.url;
              
              // 格式化時間
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
              
              return (
                <div key={post._id} className="bg-zinc-900 rounded-xl p-6 hover:bg-zinc-800 transition-colors">
                  <div className="flex gap-4">
                    {/* 引用图片（可點擊打開 ImageModal） */}
                    {post.imageRef && imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt={post.imageRef.title || '帖子圖片'}
                          className="w-24 h-24 object-cover rounded-lg border border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedImage(post.imageRef._id)}
                        />
                      </div>
                    )}
                    
                    {/* 上传图片（不可點擊） */}
                    {!post.imageRef && post.uploadedImage && (
                      <div className="flex-shrink-0">
                        <img
                          src={post.uploadedImage.url}
                          alt="帖子圖片"
                          className="w-24 h-24 object-cover rounded-lg border border-zinc-700"
                        />
                      </div>
                    )}

                    {/* 帖子内容 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {/* 置頂標誌 */}
                        {post.isPinned && (
                          <>
                            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-500 text-xs rounded-full font-semibold">
                              <Pin className="w-3 h-3" />
                              置頂
                            </span>
                            {/* 管理員調整順序按鈕 */}
                            {currentUser && (currentUser.role === 'admin' || currentUser.isAdmin) && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handlePinOrder(post._id, 'up')}
                                  className="p-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                  title="上移（在列表中更靠前）"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handlePinOrder(post._id, 'down')}
                                  className="p-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                  title="下移（在列表中更靠后）"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                        
                        <span className="px-2 py-1 bg-zinc-700 text-xs rounded-full">
                          {categories.find(cat => cat.id === post.category)?.icon} 
                          {categories.find(cat => cat.id === post.category)?.name}
                        </span>
                        <span className="text-gray-500 text-sm">• {formatTime(post.createdAt)}</span>
                        
                        {/* 刪除按鈕（作者或管理員可見） */}
                        {currentUser && (
                          currentUser._id === post.author?._id || 
                          currentUser._id === post.author?.toString() ||
                          currentUser.role === 'admin'
                        ) && (
                          <button
                            onClick={() => handleDelete(post._id)}
                            className="ml-auto p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="刪除帖子"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>


                      <Link href={`/discussion/${post._id}`}>
                        <h2 className="text-xl font-semibold text-white mb-2 hover:text-blue-400 cursor-pointer">
                          {post.title}
                        </h2>
                      </Link>

                      <p className="text-gray-300 mb-4 line-clamp-3 whitespace-pre-line">
                        {getTextPreview(post.content)}
                      </p>

                      {/* 互动按钮 */}
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleLike(post._id)}
                          className={`flex items-center gap-1 transition-colors ${
                            post.likes?.includes(currentUser?._id) 
                              ? 'text-red-500' 
                              : 'text-gray-400 hover:text-red-400'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${post.likes?.includes(currentUser?._id) ? 'fill-current' : ''}`} />
                          <span>{post.likesCount || 0}</span>
                        </button>
                        <Link
                          href={`/discussion/${post._id}`}
                          className="flex items-center gap-1 text-gray-400 hover:text-blue-400 transition-colors"
                          title="查看評論"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.commentsCount || 0}</span>
                        </Link>
                        <button 
                          onClick={() => handleBookmark(post._id)}
                          className={`flex items-center gap-1 transition-colors ${
                            post.bookmarks?.includes(currentUser?._id) 
                              ? 'text-yellow-500' 
                              : 'text-gray-400 hover:text-yellow-400'
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${post.bookmarks?.includes(currentUser?._id) ? 'fill-current' : ''}`} />
                          <span>{post.bookmarksCount || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleShare(post._id)}
                          className="flex items-center gap-1 text-gray-400 hover:text-green-400 transition-colors"
                          title="分享鏈接"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">暫無帖子</h3>
                <p className="text-gray-500 mb-4">還沒有符合條件的討論帖子</p>
                <Link
                  href="/discussion/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  發佈第一個帖子
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ImageModal - 點擊引用圖片時打開 */}
      {selectedImage && (
        <ImageModal
          imageId={selectedImage}
          currentUser={currentUser}
          onClose={() => setSelectedImage(null)}
        />
      )}
      <BackToTopButton />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, Search, X } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";

const categories = [
  { id: "announcement", name: "官方公告", icon: "📢", adminOnly: true },
  { id: "technical", name: "技術討論", icon: "⚙️" },
  { id: "showcase", name: "作品展示", icon: "🎨" },
  { id: "question", name: "問題求助", icon: "❓" },
  { id: "tutorial", name: "教學分享", icon: "📚" },
  { id: "general", name: "閒聊", icon: "💬" }
];

export default function EditDiscussionPost() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general"
  });
  
  // 圖片相關狀態
  const [imageRef, setImageRef] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 載入帖子數據
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/discussion/posts/${params.id}`);
        const result = await response.json();
        
        if (result.success) {
          const postData = result.data; // 修正：使用 result.data 而不是 result.post
          setPost(postData);
          setFormData({
            title: postData.title || "",
            content: postData.content || "",
            category: postData.category || "general"
          });
          
          // 設置現有圖片
          if (postData.imageRef) {
            setImageRef(postData.imageRef);
          }
          if (postData.uploadedImage) {
            setUploadedImage(postData.uploadedImage);
          }
        } else {
          notify.error("載入失敗", "載入帖子失敗");
          router.push("/discussion");
        }
      } catch (error) {
        console.error("載入帖子錯誤:", error);
        notify.error("載入失敗", "載入帖子失敗");
        router.push("/discussion");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [params.id, router]);

  // 權限檢查
  useEffect(() => {
    if (!loading && post && currentUser) {
      const isAuthor = currentUser._id === post.author?._id || currentUser._id === post.author?.toString();
      const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;
      
      if (!isAuthor && !isAdmin) {
        notify.warning("權限不足", "無權限編輯此帖子");
        router.push(`/discussion/${params.id}`);
      }
    }
  }, [loading, post, currentUser, router, params.id]);

  // 圖片搜索
  useEffect(() => {
    if (searchQuery.trim()) {
      setSearchLoading(true);
      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/images?q=${encodeURIComponent(searchQuery)}&limit=10`);
          const result = await response.json();
          if (result.images) {
            setSearchResults(result.images);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error("搜索圖片失敗:", error);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const selectImage = (image) => {
    setImageRef(image);
    setShowImageSearch(false);
    setSearchQuery("");
  };

  const removeImageRef = () => {
    setImageRef(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedImage({ file });
    }
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("content", formData.content);
      submitData.append("category", formData.category);
      
      // 添加圖片引用
      if (imageRef?.id) {
        submitData.append("imageRefId", imageRef.id);
      }
      
      // 添加上傳的圖片（只有當用戶選擇了新文件時）
      if (uploadedImage?.file && uploadedImage.file instanceof File) {
        submitData.append("uploadedImage", uploadedImage.file);
        console.log("🔧 [編輯] 準備上傳新圖片:", uploadedImage.file.name);
      } else {
        console.log("🔧 [編輯] 沒有新圖片需要上傳");
      }
      
      const response = await fetch(`/api/discussion/posts/${params.id}`, {
        method: "PUT",
        body: submitData
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ 帖子更新成功:", result.data);
        router.push(`/discussion/${params.id}`);
      } else {
        console.error("❌ 更新失敗:", result.error);
        notify.error("更新失敗", result.error || "請稍後再試");
      }
    } catch (error) {
      console.error("❌ 提交錯誤:", error);
      notify.error("提交失敗", "請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">帖子不存在</p>
          <Link href="/discussion" className="text-blue-400 hover:underline mt-2 block">
            返回討論區
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 頁面頭部 */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/discussion/${params.id}`}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">編輯帖子</h1>
              <p className="text-gray-400 text-sm">修改你的討論區帖子</p>
            </div>
          </div>
        </div>
      </div>

      {/* 表單內容 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl p-6">
          {/* 標題 */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
              標題 *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="輸入帖子標題..."
              required
            />
          </div>

          {/* 分類 */}
          <div className="mb-6">
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
              分類 *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {categories
                .filter(category => {
                  if (category.adminOnly) {
                    return currentUser?.role === 'admin' || currentUser?.isAdmin;
                  }
                  return true;
                })
                .map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 圖片選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              圖片
            </label>
            
            {/* 引用圖片 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowImageSearch(!showImageSearch)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  搜索引用圖片
                </button>
              </div>
              
              {imageRef && (
                <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                  <img
                    src={`https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageRef.imageId}/public`}
                    alt={imageRef.title}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{imageRef.title}</p>
                    <p className="text-sm text-gray-400">引用圖片</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeImageRef}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {showImageSearch && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索圖片..."
                    className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {searchLoading ? (
                    <div className="text-center py-4 text-gray-500">搜索中...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                      {searchResults.map(img => (
                        <div
                          key={img._id}
                          onClick={() => selectImage(img)}
                          className="cursor-pointer group"
                        >
                          <img
                            src={`https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`}
                            alt={img.title}
                            className="w-full h-24 object-cover rounded group-hover:opacity-80 transition-opacity"
                          />
                          <p className="text-xs text-gray-400 mt-1 truncate">{img.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery && (
                    <div className="text-center py-4 text-gray-500">沒有找到相關圖片</div>
                  )}
                </div>
              )}
            </div>
            
            {/* 上傳圖片 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="image-upload" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  上傳圖片
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              
              {uploadedImage && (
                <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                  {uploadedImage.file ? (
                    <>
                      <img
                        src={URL.createObjectURL(uploadedImage.file)}
                        alt="上傳的圖片"
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{uploadedImage.file.name}</p>
                        <p className="text-sm text-gray-400">新上傳的圖片</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={uploadedImage.url}
                        alt="上傳的圖片"
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{uploadedImage.fileName || "上傳的圖片"}</p>
                        <p className="text-sm text-gray-400">現有上傳圖片</p>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={removeUploadedImage}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 內容 */}
          <div className="mb-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">
              內容 *
            </label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 min-h-[300px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="輸入帖子內容..."
              required
            />
          </div>

          {/* 提交按鈕 */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href={`/discussion/${params.id}`}
              className="px-6 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "更新中..." : "更新帖子"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Upload, X, Search, Image as ImageIcon, Camera, Link as LinkIcon } from "lucide-react";
import Link from "next/link";

export default function CreatePostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    imageRef: null,
    uploadedImage: null
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRefImage, setLoadingRefImage] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const categories = [
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

  // 從URL載入引用圖片
  useEffect(() => {
    const imageRefId = searchParams.get('imageRef');
    
    if (imageRefId) {
      setLoadingRefImage(true);
      
      fetch(`/api/images/${imageRefId}`)
        .then(res => res.json())
        .then(data => {
          // 檢查API回應格式 (使用ok字段)
          let image = null;
          if (data.ok && data.image) {
            image = data.image;
          } else if (data.success && data.image) {
            image = data.image;
          } else if (data.image) {
            // 直接返回image對象的情況
            image = data.image;
          }
          
          if (image) {
            setFormData(prev => ({
              ...prev,
              imageRef: {
                id: image._id,
                title: image.title,
                thumbnail: `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`,
                author: image.user?.username || '未知用戶'
              }
            }));
          } else {
            // 嘗試直接使用data作為image
            if (data._id || data.title) {
              setFormData(prev => ({
                ...prev,
                imageRef: {
                  id: data._id,
                  title: data.title,
                  thumbnail: `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${data.imageId}/public`,
                  author: data.user?.username || '未知用戶'
                }
              }));
            }
          }
        })
        .catch(err => {
          console.error('載入引用圖片失敗:', err);
        })
        .finally(() => {
          setLoadingRefImage(false);
        });
    }
  }, [searchParams]);

  // 真實圖片搜索
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      setSearchLoading(true);
      
      // 真實搜索延遲
      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/images?search=${encodeURIComponent(searchQuery.trim())}&limit=20`);
          const data = await response.json();
          
          if (data.images && Array.isArray(data.images)) {
            // 轉換API數據格式為搜索結果格式
            const searchResults = data.images.map(img => ({
              id: img._id,
              title: img.title || '（無標題）',
              thumbnail: img.imageId 
                ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`
                : '/default-image.svg',
              author: img.user?.username || '未知用戶',
              category: img.category || '未分類'
            }));
            setSearchResults(searchResults);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error('搜索圖片失敗:', error);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500); // 增加延遲避免過於頻繁的請求
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("content", formData.content);
      submitData.append("category", formData.category);
      
      // 添加圖片引用
      if (formData.imageRef?.id) {
        submitData.append("imageRefId", formData.imageRef.id);
      }
      
      // 添加上傳的圖片
      if (formData.uploadedImage?.file) {
        submitData.append("uploadedImage", formData.uploadedImage.file);
      }
      
      const response = await fetch("/api/discussion/posts", {
        method: "POST",
        body: submitData
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ 帖子創建成功:", result.data);
        router.push("/discussion");
      } else {
        console.error("❌ 創建失敗:", result.error);
        alert(result.error || "創建帖子失敗");
      }
    } catch (error) {
      console.error("❌ 提交錯誤:", error);
      alert("提交失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const selectImage = (image) => {
    setFormData(prev => ({ ...prev, imageRef: image }));
    setShowImageSearch(false);
    setSearchQuery("");
  };

  const removeImageRef = () => {
    setFormData(prev => ({ ...prev, imageRef: null }));
  };

  const removeUploadedImage = () => {
    setFormData(prev => ({ ...prev, uploadedImage: null }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 檢查檔案類型
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片檔案');
        return;
      }

      // 檢查檔案大小 (5MB限制)
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片大小不能超過 5MB');
        return;
      }

      // 建立預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ 
          ...prev, 
          uploadedImage: {
            file: file,
            preview: e.target.result,
            name: file.name
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 页面头部 */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/discussion"
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">發佈新帖子</h1>
          </div>
        </div>
      </div>

      {/* 表单内容 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 帖子标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              帖子標題 *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="輸入帖子標題..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg 
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              分類 *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg 
                         text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* 图片选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              添加圖片（可選）
            </label>
            
            {/* 載入中狀態 */}
            {loadingRefImage && (
              <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700 mb-3">
                <div className="w-16 h-16 bg-zinc-700 rounded-lg animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-zinc-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-zinc-700 rounded animate-pulse w-1/2"></div>
                </div>
                <div className="text-gray-400 text-sm">載入中...</div>
              </div>
            )}

            {/* 已选择的图片显示 */}
            {(formData.imageRef || formData.uploadedImage) && !loadingRefImage && (
              <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700 mb-3">
                <img
                  src={formData.imageRef?.thumbnail || formData.uploadedImage?.preview}
                  alt={formData.imageRef?.title || formData.uploadedImage?.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-white">
                    {formData.imageRef?.title || formData.uploadedImage?.name}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {formData.imageRef ? `by ${formData.imageRef.author}` : '新上傳的圖片'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={formData.imageRef ? removeImageRef : removeUploadedImage}
                  className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 图片选择方式 - 只在没有图片时显示 */}
            {!formData.imageRef && !formData.uploadedImage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 上传新图片 */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-4 border-2 border-dashed border-zinc-700 rounded-lg 
                               hover:border-green-500 hover:bg-zinc-800 transition-colors
                               flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-green-400
                               h-24">
                  <Camera className="w-6 h-6" />
                  <span className="text-sm font-medium">上傳圖片</span>
                  <span className="text-xs">截圖、照片等</span>
                </div>
              </div>

              {/* 引用现有图片 */}
              <button
                type="button"
                onClick={() => setShowImageSearch(true)}
                className="p-4 border-2 border-dashed border-zinc-700 rounded-lg 
                           hover:border-blue-500 hover:bg-zinc-800 transition-colors
                           flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-400
                           h-24"
              >
                <LinkIcon className="w-6 h-6" />
                <span className="text-sm font-medium">引用圖片</span>
                <span className="text-xs">搜索現有圖片</span>
              </button>
              </div>
            )}
          </div>

          {/* 帖子内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              帖子內容 *
            </label>
            <textarea
              required
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="分享你的想法、經驗或問題..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg 
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-y"
            />
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 
                         text-white font-semibold rounded-lg hover:shadow-lg transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "發佈中..." : "發佈帖子"}
            </button>
            <Link
              href="/discussion"
              className="px-6 py-3 bg-zinc-800 text-white font-semibold rounded-lg 
                         hover:bg-zinc-700 transition-colors"
            >
              取消
            </Link>
          </div>
        </form>
      </div>

      {/* 图片搜索弹窗 */}
      {showImageSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">搜索圖片</h3>
                <button
                  onClick={() => setShowImageSearch(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索圖片標題、作者..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg 
                             text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  {searchLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-400">搜索中...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchResults.map(image => (
                        <button
                          key={image.id}
                          onClick={() => selectImage(image)}
                          className="p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-left"
                        >
                          <div className="flex gap-3">
                            <img
                              src={image.thumbnail}
                              alt={image.title}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                e.target.src = '/default-image.svg';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white truncate">{image.title}</h4>
                              <p className="text-sm text-gray-400">by {image.author}</p>
                              <p className="text-xs text-gray-500">{image.category}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery && searchQuery.trim().length >= 2 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>未找到相關圖片</p>
                      <p className="text-sm mt-2">嘗試使用不同的關鍵詞</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>輸入關鍵詞搜索圖片</p>
                      <p className="text-sm mt-2">至少輸入2個字符</p>
                    </div>
                  )}
                </div>
          </div>
        </div>
      )}
    </div>
  );
}

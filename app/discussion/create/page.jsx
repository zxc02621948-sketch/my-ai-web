"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Upload, X, Search, Image as ImageIcon, Camera, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function CreatePostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useCurrentUser();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    rating: "一般",
    imageRef: null,
    uploadedImages: [] // 改為多圖數組
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRefImage, setLoadingRefImage] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const categories = [
    { id: "announcement", name: "官方公告", icon: "📢", adminOnly: true },
    { id: "technical", name: "技術討論", icon: "⚙️" },
    { id: "showcase", name: "作品展示", icon: "🎨" },
    { id: "question", name: "問題求助", icon: "❓" },
    { id: "tutorial", name: "教學分享", icon: "📚" },
    { id: "general", name: "閒聊", icon: "💬" }
  ];

  // 從 URL 自動設置分級
  useEffect(() => {
    const isAdultZone = searchParams.get('zone') === 'adult';
    if (isAdultZone) {
      setFormData(prev => ({ ...prev, rating: "18" }));
    }
  }, [searchParams]);

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
      submitData.append("rating", formData.rating);
      
      // 添加圖片引用
      if (formData.imageRef?.id) {
        submitData.append("imageRefId", formData.imageRef.id);
      }
      
      // 添加多張上傳的圖片
      if (formData.uploadedImages.length > 0) {
        formData.uploadedImages.forEach((img, index) => {
          submitData.append(`uploadedImages[${index}]`, img.file);
        });
      }
      
      console.log('📝 準備發布:', {
        title: formData.title,
        category: formData.category,
        imageCount: formData.uploadedImages.length,
        hasImageRef: !!formData.imageRef
      });
      
      const response = await fetch("/api/discussion/posts", {
        method: "POST",
        body: submitData
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ 帖子創建成功:", result.data);
        
        // 顯示成功提示
        if (result.pointsCost > 0) {
          alert(`✅ 發布成功！已消耗 ${result.pointsCost} 積分\n💡 收到的愛心會回饋積分給你！`);
        } else {
          alert('✅ 發布成功！');
        }
        
        router.push(`/discussion/${result.data._id}`);
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

  const handleMultiImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // 檢查總數量限制
    if (formData.uploadedImages.length + files.length > 9) {
      alert(`最多只能上傳 9 張圖片！當前已有 ${formData.uploadedImages.length} 張`);
      return;
    }
    
    // 處理每個文件
    const newImages = [];
    let processedCount = 0;
    
    files.forEach((file, index) => {
      // 檢查檔案類型
      if (!file.type.startsWith('image/')) {
        alert(`文件 ${file.name} 不是圖片`);
        return;
      }
      
      // 檢查檔案大小 (10MB限制)
      if (file.size > 10 * 1024 * 1024) {
        alert(`圖片 ${file.name} 超過 10MB`);
        return;
      }
      
      // 建立預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        newImages.push({
          file: file,
          preview: e.target.result,
          name: file.name,
          size: file.size,
          order: formData.uploadedImages.length + index
        });
        
        processedCount++;
        
        // 當所有文件都處理完成後，更新狀態
        if (processedCount === files.length) {
          setFormData(prev => ({
            ...prev,
            uploadedImages: [...prev.uploadedImages, ...newImages]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeUploadedImage = (index) => {
    setFormData(prev => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter((_, i) => i !== index)
    }));
  };

  const insertImageTag = (index) => {
    const tag = `{{image:${index}}}`;
    const textarea = document.querySelector('textarea[name="content"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const newText = text.substring(0, start) + tag + text.substring(end);
      
      setFormData(prev => ({ ...prev, content: newText }));
      
      // 恢復光標位置
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
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
              {categories
                .filter(category => {
                  // 過濾掉「僅管理員」分類（非管理員看不到）
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

          {/* 分級提示（隱藏選擇器，自動根據來源設置） */}
          {searchParams.get('zone') === 'adult' && (
            <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
              <p className="text-red-400 text-sm flex items-center gap-2">
                🔞 <span className="font-semibold">您正在 18+ 討論區發文</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">
                此帖子將僅在 18+ 討論區顯示
              </p>
            </div>
          )}

          {/* 多圖上傳 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              添加圖片（可選，最多 9 張）
            </label>
            
            {/* 已上傳的圖片網格 */}
            {formData.uploadedImages.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {formData.uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="w-full h-32 object-cover rounded-lg border border-zinc-700"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => insertImageTag(index)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          title="插入到內容"
                        >
                          插入 #{index}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUploadedImage(index)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="刪除"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        #{index}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="text-sm text-gray-400">
                  💡 在內容中輸入 <code className="bg-zinc-800 px-2 py-1 rounded">{'{{image:0}}'}</code> 來插入圖片，或點擊「插入」按鈕
                </div>
              </div>
            )}
            
            {/* 上傳按鈕 */}
            {formData.uploadedImages.length < 9 && (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-4 border-2 border-dashed border-zinc-700 rounded-lg 
                               hover:border-green-500 hover:bg-zinc-800 transition-colors
                               flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-green-400
                               h-24 cursor-pointer">
                  <Camera className="w-6 h-6" />
                  <span className="text-sm font-medium">
                    {formData.uploadedImages.length > 0 
                      ? `繼續上傳圖片（${formData.uploadedImages.length}/9）` 
                      : '上傳圖片（支援多選）'}
                  </span>
                  <span className="text-xs">支援一次選擇多張圖片</span>
                </div>
              </div>
            )}
            
            {/* 積分提示 */}
            {formData.uploadedImages.length >= 2 && (
              <div className="mt-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1">
                    <div className="font-bold text-blue-400 mb-2">
                      多圖教學帖
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>• 發布需要消耗 <span className="text-yellow-400 font-bold">
                        {formData.uploadedImages.length <= 5 ? '5' : '10'} 積分</span></div>
                      <div>• 如果是教學文章，收到的每個愛心會回饋 <span className="text-green-400 font-bold">
                        1 積分</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 帖子内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              帖子內容 *
            </label>
            <textarea
              name="content"
              required
              rows={8}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="分享你的想法、經驗或問題...&#10;&#10;提示：使用 {{image:0}} 來插入第 0 張圖片"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg 
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-y"
            />
            {formData.uploadedImages.length > 0 && (
              <div className="text-xs text-gray-400 mt-2">
                💡 提示：點擊圖片上的「插入」按鈕，或手動輸入 {'{{image:N}}'} 來插入圖片到內容中
              </div>
            )}
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

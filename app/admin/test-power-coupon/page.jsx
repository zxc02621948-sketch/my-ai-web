// app/admin/test-power-coupon/page.jsx
// 加成券測試頁面

"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";

export default function TestPowerCouponPage() {
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponType, setCouponType] = useState("7day");
  const [useCouponId, setUseCouponId] = useState("");
  const [useContentType, setUseContentType] = useState("image");
  const [useContentId, setUseContentId] = useState("");
  const [verifyContentType, setVerifyContentType] = useState("image");
  const [verifyContentId, setVerifyContentId] = useState("");
  const [verifyContentTitle, setVerifyContentTitle] = useState("");
  const [verifyByTitle, setVerifyByTitle] = useState(false); // 是否使用標題驗證
  const [verifyResult, setVerifyResult] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // 搜尋相關狀態
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("image");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTarget, setSearchTarget] = useState(null); // 'use' 或 'verify'

  // 載入加成券列表
  const loadCoupons = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/test-power-coupon?action=list");
      if (res.data.success) {
        setCoupons(res.data.coupons);
      } else {
        setMessage({ type: "error", text: res.data.message || "載入失敗" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "載入失敗" });
    } finally {
      setLoading(false);
    }
  };

  // 創建測試加成券
  const handleCreateCoupon = async () => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const res = await axios.post("/api/admin/test-power-coupon", {
        action: "create",
        type: couponType,
      });

      if (res.data.success) {
        setMessage({ type: "success", text: res.data.message });
        await loadCoupons();
      } else {
        setMessage({ type: "error", text: res.data.message || "創建失敗" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "創建失敗" });
    } finally {
      setLoading(false);
    }
  };

  // 使用加成券
  const handleUseCoupon = async () => {
    if (!useCouponId || !useContentId) {
      setMessage({ type: "error", text: "請填寫所有必填項" });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const res = await axios.post("/api/admin/test-power-coupon", {
        action: "use",
        couponId: useCouponId,
        contentType: useContentType,
        contentId: useContentId,
      });

      if (res.data.success) {
        setMessage({ type: "success", text: res.data.message });
        await loadCoupons();
        // 清空表单
        setUseCouponId("");
        setUseContentId("");
      } else {
        setMessage({ type: "error", text: res.data.message || "使用失敗" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "使用失敗" });
    } finally {
      setLoading(false);
    }
  };

  // 驗證加成券加成
  const handleVerify = async () => {
    if (!verifyByTitle && !verifyContentId) {
      setMessage({ type: "error", text: "請填寫內容ID或標題" });
      return;
    }
    
    if (verifyByTitle && !verifyContentTitle) {
      setMessage({ type: "error", text: "請填寫內容標題" });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      
      // 根據是否使用標題構建URL
      const params = new URLSearchParams({
        action: "verify",
        contentType: verifyContentType,
      });
      
      if (verifyByTitle) {
        params.append("contentTitle", verifyContentTitle);
      } else {
        params.append("contentId", verifyContentId);
      }
      
      const res = await axios.get(`/api/admin/test-power-coupon?${params.toString()}`);

      if (res.data.success) {
        setVerifyResult(res.data.result);
        setMessage({ type: "success", text: "驗證成功" });
      } else {
        setMessage({ type: "error", text: res.data.message || "驗證失敗" });
        setVerifyResult(null);
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "驗證失敗" });
      setVerifyResult(null);
    } finally {
      setLoading(false);
    }
  };

  // 搜尋內容
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setMessage({ type: "error", text: "請輸入搜尋關鍵詞" });
      return;
    }

    try {
      setSearching(true);
      setMessage({ type: "", text: "" });

      let apiUrl = "";
      switch (searchType) {
        case "image":
          apiUrl = `/api/images?page=1&limit=20&search=${encodeURIComponent(searchQuery)}`;
          break;
        case "video":
          apiUrl = `/api/videos?page=1&limit=20&search=${encodeURIComponent(searchQuery)}`;
          break;
        case "music":
          apiUrl = `/api/music?page=1&limit=20&search=${encodeURIComponent(searchQuery)}`;
          break;
      }

      const res = await axios.get(apiUrl);
      const items = searchType === "image" 
        ? res.data.images || []
        : searchType === "video"
        ? res.data.videos || []
        : res.data.music || [];

      setSearchResults(items);
      setShowSearchResults(true);
      
      if (items.length === 0) {
        setMessage({ type: "error", text: "未找到相關內容" });
      } else {
        setMessage({ type: "success", text: `找到 ${items.length} 個結果` });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "搜尋失敗" });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // 選擇搜尋結果
  const handleSelectSearchResult = (item, target) => {
    if (target === "use") {
      setUseContentType(searchType);
      setUseContentId(item._id);
      setShowSearchResults(false);
      setSearchQuery("");
      setMessage({ type: "success", text: `已選擇：${item.title || item._id}` });
    } else if (target === "verify") {
      setVerifyContentType(searchType);
      setVerifyContentId(item._id);
      setShowSearchResults(false);
      setSearchQuery("");
      setMessage({ type: "success", text: `已選擇：${item.title || item._id}` });
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white p-8">
      {/* 左上角返回按鈕 */}
      <Link
        href="/"
        className="absolute top-0 left-0 m-4 px-4 py-2 bg-white text-black rounded hover:bg-gray-100 font-semibold z-50"
      >
        ← 返回首頁
      </Link>

      <div className="max-w-6xl mx-auto pt-16">
        <h1 className="text-3xl font-bold mb-6">🧪 加成券測試工具</h1>
        <p className="text-gray-400 mb-8">測試加成券功能，不花費積分</p>

        {/* 訊息提示 */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded ${
              message.type === "success"
                ? "bg-green-900 text-green-100"
                : "bg-red-900 text-red-100"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 創建測試加成券 */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-700">
          <h2 className="text-xl font-bold mb-4">1️⃣ 創建測試加成券</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">加成券類型</label>
              <select
                value={couponType}
                onChange={(e) => setCouponType(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              >
                <option value="7day">7天券</option>
                <option value="30day">30天券</option>
                <option value="rare">稀有券（不过期）</option>
              </select>
            </div>
            <button
              onClick={handleCreateCoupon}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "創建中..." : "創建測試加成券"}
            </button>
          </div>
        </div>

        {/* 加成券列表 */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">2️⃣ 我的加成券列表</h2>
            <button
              onClick={loadCoupons}
              disabled={loading}
              className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 disabled:opacity-50"
            >
              刷新
            </button>
          </div>
          {coupons.length === 0 ? (
            <p className="text-gray-400">暫無加成券</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left">加成券ID</th>
                    <th className="px-4 py-2 text-left">類型</th>
                    <th className="px-4 py-2 text-left">狀態</th>
                    <th className="px-4 py-2 text-left">使用在</th>
                    <th className="px-4 py-2 text-left">過期時間</th>
                    <th className="px-4 py-2 text-left">創建時間</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-t border-zinc-700">
                      <td className="px-4 py-2 font-mono text-xs">{coupon.id}</td>
                      <td className="px-4 py-2">
                        {coupon.type === "7day"
                          ? "7天券"
                          : coupon.type === "30day"
                          ? "30天券"
                          : "稀有券"}
                      </td>
                      <td className="px-4 py-2">
                        {coupon.used ? (
                          <span className="text-green-400">✅ 已使用</span>
                        ) : (
                          <span className="text-yellow-400">❌ 未使用</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {coupon.usedOnContentId ? (
                          <>
                            {coupon.contentType || "N/A"} (
                            <span className="font-mono text-xs">{coupon.usedOnContentId}</span>)
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {coupon.expiry
                          ? new Date(coupon.expiry).toLocaleString("zh-TW")
                          : "永不过期"}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(coupon.createdAt).toLocaleString("zh-TW")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 搜尋內容（查找內容ID） */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-700">
          <h2 className="text-xl font-bold mb-4">🔍 搜尋內容（查找內容ID）</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">內容類型</label>
                <select
                  value={searchType}
                  onChange={(e) => {
                    setSearchType(e.target.value);
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                >
                  <option value="image">图片</option>
                  <option value="video">影片</option>
                  <option value="music">音乐</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">搜尋關鍵詞（標題、描述等）</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="輸入標題搜尋..."
                    className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {searching ? "搜尋中..." : "搜尋"}
                  </button>
                </div>
              </div>
            </div>
            
            {showSearchResults && searchResults.length > 0 && (
              <div className="mt-4 p-4 bg-zinc-800 rounded border border-zinc-700 max-h-64 overflow-y-auto">
                <h3 className="text-sm font-medium mb-3 text-gray-400">搜尋結果（點擊選擇）</h3>
                <div className="space-y-2">
                  {searchResults.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 bg-zinc-700 rounded hover:bg-zinc-600 cursor-pointer border border-transparent hover:border-blue-500"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-white mb-1">
                            {item.title || "無標題"}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            ID: {item._id}
                          </div>
                          {item.user && (
                            <div className="text-xs text-gray-400 mt-1">
                              作者: {item.user.username || "未知"}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              handleSelectSearchResult(item, "use");
                              setSearchTarget("use");
                            }}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            用於使用
                          </button>
                          <button
                            onClick={() => {
                              handleSelectSearchResult(item, "verify");
                              setSearchTarget("verify");
                            }}
                            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            用於驗證
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-zinc-800 rounded border border-zinc-700 text-sm text-gray-400">
              <p className="mb-2">💡 <strong>什麼是內容ID？</strong></p>
              <p className="mb-1">內容ID是圖片/影片/音樂的唯一標識符（資料庫的 <code className="bg-zinc-700 px-1 rounded">_id</code> 欄位）</p>
              <p className="mb-1"><strong>取得方式：</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>使用上方搜尋功能，輸入標題搜尋內容，然後點擊"用於使用"或"用於驗證"</li>
                <li>從URL中取得（例如：<code className="bg-zinc-700 px-1 rounded">/images?id=xxx</code>，xxx就是圖片ID）</li>
                <li>從瀏覽器開發者工具中查看API響應（Network標籤頁）</li>
                <li>手動輸入（需要知道準確的ID）</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 使用加成券 */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-700">
          <h2 className="text-xl font-bold mb-4">3️⃣ 使用加成券</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">加成券ID</label>
              <input
                type="text"
                value={useCouponId}
                onChange={(e) => setUseCouponId(e.target.value)}
                placeholder="貼上加成券ID"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">內容類型</label>
                <select
                  value={useContentType}
                  onChange={(e) => setUseContentType(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                >
                  <option value="image">圖片</option>
                  <option value="video">影片</option>
                  <option value="music">音樂</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">內容ID</label>
                <input
                  type="text"
                  value={useContentId}
                  onChange={(e) => setUseContentId(e.target.value)}
                  placeholder="貼上內容ID"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                />
              </div>
            </div>
            <button
              onClick={handleUseCoupon}
              disabled={loading || !useCouponId || !useContentId}
              className="w-full px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "使用中..." : "使用加成券"}
            </button>
          </div>
        </div>

        {/* 驗證加成券加成 */}
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-700">
          <h2 className="text-xl font-bold mb-4">4️⃣ 驗證加成券加成</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">內容類型</label>
                <select
                  value={verifyContentType}
                  onChange={(e) => setVerifyContentType(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                >
                  <option value="image">圖片</option>
                  <option value="video">影片</option>
                  <option value="music">音樂</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  查詢方式
                  <span className="ml-2 text-xs text-gray-400">（可選）</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={!verifyByTitle}
                      onChange={() => {
                        setVerifyByTitle(false);
                        setVerifyContentTitle("");
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">使用ID</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={verifyByTitle}
                      onChange={() => {
                        setVerifyByTitle(true);
                        setVerifyContentId("");
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">使用標題</span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {verifyByTitle ? "內容標題" : "內容ID"}
              </label>
              {verifyByTitle ? (
                <input
                  type="text"
                  value={verifyContentTitle}
                  onChange={(e) => setVerifyContentTitle(e.target.value)}
                  placeholder="輸入內容標題..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                />
              ) : (
                <input
                  type="text"
                  value={verifyContentId}
                  onChange={(e) => setVerifyContentId(e.target.value)}
                  placeholder="貼上內容ID"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                />
              )}
            </div>
            <button
              onClick={handleVerify}
              disabled={loading || (verifyByTitle ? !verifyContentTitle : !verifyContentId)}
              className="w-full px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "驗證中..." : "驗證加成"}
            </button>
            {verifyResult && (
              <div className="mt-6 p-4 bg-zinc-800 rounded border border-zinc-700">
                <h3 className="font-bold mb-3">驗證結果</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">內容標題:</span>
                    <span className="ml-2">{verifyResult.title || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">上傳時間:</span>
                    <span className="ml-2">
                      {new Date(verifyResult.createdAt).toLocaleString("zh-TW")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">權力券使用時間:</span>
                    <span className="ml-2">
                      {verifyResult.powerUsedAt
                        ? new Date(verifyResult.powerUsedAt).toLocaleString("zh-TW")
                        : "無"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">權力券過期時間:</span>
                    <span className="ml-2">
                      {verifyResult.powerExpiry
                        ? new Date(verifyResult.powerExpiry).toLocaleString("zh-TW")
                        : "無"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">有效創建時間:</span>
                    <span className="ml-2">
                      {new Date(verifyResult.effectiveCreatedAt).toLocaleString("zh-TW")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">經過小時:</span>
                    <span className="ml-2">{verifyResult.hoursElapsed.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">加成因子:</span>
                    <span className="ml-2">{verifyResult.boostFactor.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">當前加成:</span>
                    <span className="ml-2">{verifyResult.currentBoost.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">初始加成:</span>
                    <span className="ml-2">{verifyResult.initialBoost}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">是否在窗口內:</span>
                    <span className="ml-2">
                      {verifyResult.stillInWindow ? "✅ 是" : "❌ 否"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">資料庫分數:</span>
                    <span className="ml-2">{verifyResult.popScoreDB.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">即時分數:</span>
                    <span className="ml-2">{verifyResult.livePopScore.toFixed(2)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">加成計算:</span>
                    <span className="ml-2">
                      {verifyResult.isUsingPowerTime
                        ? "✅ 正確：使用加成券時間計算加成"
                        : "⚠️  使用上傳時間計算加成"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


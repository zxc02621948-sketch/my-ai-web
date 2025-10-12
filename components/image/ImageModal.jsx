"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import MobileImageSheet from "@/components/image/MobileImageSheet";
import DesktopRightPane from "@/components/image/DesktopRightPane";
import axios from "axios";
import { getLikesFromCache } from "@/lib/likeSync";
import EditImageModal from "@/components/image/EditImageModal"; // ← 你的編輯彈窗

const getOwnerId = (img) => {
  if (!img) return null;
  const u = img.user ?? img.userId;
  return typeof u === "string" ? u : u?._id ?? null;
};

const inFollowing = (list, uid) =>
  Array.isArray(list) &&
  list.some((f) => {
    const id = typeof f === "object" && f !== null ? f.userId : f;
    return String(id) === String(uid);
  });

export default function ImageModal({
  imageId,
  imageData,
  prevImage,
  nextImage,
  onClose,
  currentUser,
  onLikeUpdate,
  onNavigate,
  onFollowChange,     // 父層回寫 currentUser.following
  followOverrides,    // Map: userId -> boolean（前端優先）
  onImageUpdated,     // 可選：讓父層也能接到「已更新」
}) {
  const router = useRouter();
  const followLockRef = useRef(false);
  const viewedRef = useRef(new Set());

  // ---- 先定義 state，再根據 state 推導 currentId（修復點） ----
  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // 由已載入的 image 為主，否則回退到 props
  const currentId = image?._id ?? imageId ?? imageData?._id ?? null;


  // === 編輯彈窗：開關 + 回寫 ===
  const [isEditOpen, setIsEditOpen] = useState(false);
  const openEdit = () => setIsEditOpen(true);
  const closeEdit = () => setIsEditOpen(false);
  const handleEditUpdated = (updated) => {
    if (!updated) return;
    setImage((prev) => {
      if (!prev) return updated;
      const merged = { ...prev, ...updated };
      // 若後端沒回 user，就保留原本的 user（含 isFollowing）
      if (!updated.user && prev.user) merged.user = prev.user;
      return merged;
    });
    onImageUpdated?.(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("image-updated", {
          detail: { imageId: updated._id || image?._id, updated },
        })
      );
    }
    setIsEditOpen(false);
  };

  // 載入圖片（若只有 id）
  useEffect(() => {
    if (imageData?._id) {
      setImage(imageData);
      setLoading(false);
      setError(null);
      return;
    }
    if (!imageId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/images/${imageId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error("找不到該圖片，可能已被刪除");
        if (alive) {
          setImage(data.image);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err.message || "載入失敗");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [imageId, imageData]);

  // ✅ 每次「切換到新圖片」時，呼叫一次點擊 API，並把回傳寫回本地 state
  useEffect(() => {
    if (!currentId) return;

    // 避免同一張在同一次開啟中被重複計分
    if (viewedRef.current.has(currentId)) return;
    viewedRef.current.add(currentId);

    fetch(`/api/images/${currentId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok) return;
        // 把 server 更新後的 clicks / likesCount / popScore 回寫到當前 image
        setImage((prev) =>
          prev && prev._id === currentId
            ? {
                ...prev,
                clicks: data.clicks ?? prev.clicks,
                likesCount: data.likesCount ?? prev.likesCount,
                popScore: data.popScore ?? prev.popScore,
              }
            : prev
        );
      })
      .catch(() => {});
  }, [currentId]);

  useEffect(() => {
    if (image && typeof image.user === "string") {
      setImage((prev) =>
        prev ? { ...prev, user: { _id: prev.user, isFollowing: false } } : prev
      );
    }
  }, [image]);

  useEffect(() => {
    const id = image?._id || imageId || imageData?._id;
    if (!id) return;
    const cached = getLikesFromCache(id);
    if (cached && Array.isArray(cached)) {
      setImage((prev) =>
        prev ? { ...prev, likes: cached, likesCount: cached.length } : prev
      );
    }
  }, [image?._id, imageId, imageData]);

  // 若 user 是字串 → 補抓作者物件
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    if (!u || typeof u !== "string") return;

    let alive = true;
    (async () => {
      try {
        let userObj = null;
        try {
          const r = await fetch(`/api/user/${u}`, { cache: "no-store" });
          if (r.ok) {
            const data = await r.json();
            userObj = data?.user || data?.data || null;
          }
        } catch {}
        if (!userObj && image?._id) {
          try {
            const r2 = await fetch(`/api/images/${image._id}`, { cache: "no-store" });
            if (r2.ok) {
              const d2 = await r2.json();
              userObj = d2?.image?.user || null;
            }
          } catch {}
        }
        if (alive && userObj && typeof userObj === "object") {
          setImage((prev) => (prev ? { ...prev, user: userObj } : prev));
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [image]);

  // 根據 followOverrides / currentUser.following 計算是否已追蹤（覆蓋優先）
  const ownerId = getOwnerId(image);
  useEffect(() => {
    if (!ownerId) return;
    const ov = followOverrides?.get?.(String(ownerId));
    if (typeof ov === "boolean") {
      setIsFollowing(ov);
    } else {
      setIsFollowing(inFollowing(currentUser?.following, ownerId));
    }
  }, [currentUser, ownerId, followOverrides]);

  // ✅ 追蹤切換（沿用你舊版：axios + userIdToFollow / userIdToUnfollow）
  const handleFollowToggle = async () => {
    if (!ownerId) return;
    if (followLockRef.current) return; // 防連點
    followLockRef.current = true;

    const next = !isFollowing;
    setIsFollowing(next);

    try {
      // 帶上認證，和 DesktopRightPane 的做法一致
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (next) {
        await axios.post(
          "/api/follow",
          { userIdToFollow: ownerId },
          { headers, withCredentials: true }
        );
      } else {
        await axios.delete("/api/follow", {
          data: { userIdToUnfollow: ownerId },
          headers,
          withCredentials: true,
        });
      }

      // 成功：通知父層同步 currentUser.following + 覆蓋表
      onFollowChange?.(String(ownerId), next);
    } catch (e) {
      // 失敗還原
      setIsFollowing(!next);
      console.error("❌ 追蹤切換失敗", e);
    } finally {
      setTimeout(() => {
        followLockRef.current = false;
      }, 300);
    }
  };

  // 點作者 → 進作者頁並關閉 modal
  const handleUserClick = () => {
    if (ownerId) {
      router.push(`/user/${ownerId}`);
      handleBackdropClick();
    }
  };

  // 刪除圖片（作者本人）
  const handleDelete = async (id) => {
    if (!window.confirm("你確定要刪除這張圖片嗎？")) return;
    try {
      const res = await fetch("/api/delete-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id }),
      });
      if (!res.ok) throw new Error("刪除失敗");
      alert("圖片刪除成功！");
      window.location.reload();
      onClose?.();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  // 權力券使用狀態
  const [isPowerCouponModalOpen, setIsPowerCouponModalOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [isUsingCoupon, setIsUsingCoupon] = useState(false);

  // 權力券使用
  const handlePowerCouponUse = async (imageId) => {
    try {
      // 獲取用戶的權力券列表
      const res = await axios.get('/api/power-coupon/user-coupons', {
        withCredentials: true
      });
      
      if (!res?.data?.success) {
        alert('獲取權力券失敗');
        return;
      }
      
      const coupons = res.data.coupons || [];
      if (coupons.length === 0) {
        alert('你沒有可用的權力券！請先到積分商店購買。');
        return;
      }
      
      // 設置權力券數據並打開彈窗
      setAvailableCoupons(coupons);
      setSelectedCouponId(null);
      setIsPowerCouponModalOpen(true);
    } catch (error) {
      console.error('獲取權力券失敗:', error);
      alert('獲取權力券失敗，請稍後再試');
    }
  };

  // 確認使用權力券
  const confirmUseCoupon = async () => {
    if (!selectedCouponId) {
      alert('請選擇要使用的權力券');
      return;
    }
    
    setIsUsingCoupon(true);
    try {
      const useRes = await axios.post('/api/power-coupon/use', {
        couponId: selectedCouponId,
        imageId: image?._id
      }, {
        withCredentials: true
      });
      
      if (useRes?.data?.success) {
        alert('權力券使用成功！圖片曝光度已提升。');
        setIsPowerCouponModalOpen(false);
        // 刷新圖片數據
        window.location.reload();
      } else {
        alert(useRes?.data?.message || '使用失敗');
      }
    } catch (error) {
      console.error('使用權力券失敗:', error);
      alert('使用失敗，請稍後再試');
    } finally {
      setIsUsingCoupon(false);
    }
  };

  // Like
  const isLikedByCurrent =
    Array.isArray(image?.likes) && currentUser?._id
      ? image.likes.includes(currentUser._id)
      : false;

  const toggleLikeOnServer = async () => {
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      if (!token || !currentUser?._id || !image?._id) return;
      const res = await fetch(`/api/like-image?id=${image._id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const likesArr = Array.isArray(data.likes) ? data.likes : image.likes || [];
        const updated = { ...image, likes: likesArr, likesCount: likesArr.length };
        setImage(updated);
        onLikeUpdate?.(updated);
        // 廣播目前登入者積分（若後端有提供）
        const balance = data?.currentUserPointsBalance;
        const uid = currentUser?._id || currentUser?.id;
        if (typeof balance === "number" && uid) {
          window.dispatchEvent(new CustomEvent("points-updated", { detail: { userId: String(uid), pointsBalance: Number(balance) } }));
        }
      }
    } catch (err) {
      console.error("❌ 點讚失敗", err);
    }
  };

  function handleBackdropClick() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  }

  // Body 鎖定 + 關閉還原 scroll（修復無限滾動時的跳躍問題）
  useEffect(() => {
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const initialScrollY = window.scrollY || window.pageYOffset || 0;
    const initialDocumentHeight = document.documentElement.scrollHeight;

    body.style.position = "fixed";
    body.style.top = `-${initialScrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      
      // 檢查頁面高度是否發生變化（無限滾動可能改變頁面高度）
      const currentDocumentHeight = document.documentElement.scrollHeight;
      const heightChanged = Math.abs(currentDocumentHeight - initialDocumentHeight) > 100;
      
      if (heightChanged) {
        // 如果頁面高度顯著變化，使用更安全的滾動恢復策略
        // 確保滾動位置不會超出新的頁面範圍
        const maxScrollY = Math.max(0, currentDocumentHeight - window.innerHeight);
        const safeScrollY = Math.min(initialScrollY, maxScrollY);
        
        console.log('🔧 [ImageModal] 檢測到頁面高度變化，安全恢復滾動位置:', {
          initialScrollY,
          safeScrollY,
          initialHeight: initialDocumentHeight,
          currentHeight: currentDocumentHeight
        });
        
        // 使用 requestAnimationFrame 確保 DOM 更新完成後再滾動
        requestAnimationFrame(() => {
          window.scrollTo(0, safeScrollY);
        });
      } else {
        // 頁面高度沒有顯著變化，使用原始滾動位置
        window.scrollTo(0, initialScrollY);
      }
    };
  }, []);

  // 桌機快捷鍵
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBackdropClick();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate ? onNavigate("prev") : onClose?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate ? onNavigate("next") : onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate]);

  const canEdit = !!currentUser?._id && !!ownerId && currentUser._id === ownerId;

  return (
    <Dialog
      open={!!(imageId || imageData)}
      onClose={handleBackdropClick}
      className="relative z-[99999]"
    >
      <div
        className="fixed inset-0 backdrop-blur-sm"
        aria-hidden="true"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />
      <div
        className="fixed inset-0 flex items-center justify-center p-0 md:p-4"
        onClick={handleBackdropClick}
      >
        <Dialog.Panel
          onClick={(e) => e.stopPropagation()}
          className="
            relative w-full md:max-w-6xl
            bg-[#1a1a1a] text白
            rounded-none md:rounded-xl shadow-lg
            overflow-y-auto md:overflow-hidden
            snap-y snap-mandatory md:snap-none
            flex flex-col md:flex-row
          "
          style={{
            height: "calc(var(--app-vh, 1vh) * 100)",
            maxHeight: "calc(var(--app-vh, 1vh) * 100)",
            WebkitOverflowScrolling: "touch",
            paddingTop: "max(env(safe-area-inset-top), 0px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
          }}
        >
          <MobileImageSheet
            image={image}
            prevImage={prevImage}
            nextImage={nextImage}
            loading={loading}
            error={error}
            currentUser={currentUser}
            isFollowing={isFollowing}
            onFollowToggle={handleFollowToggle}
            onUserClick={handleUserClick}
            onToggleLike={toggleLikeOnServer}
            onLikeUpdate={onLikeUpdate}
            onClose={handleBackdropClick}
            onNavigate={onNavigate}
          />

          <div className="hidden md:flex md:flex-row w-full">
            <div className="flex-1 bg黑 relative p-4 flex items-center justify-center">
              {loading ? (
                <div className="text-gray-400">載入中...</div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : image ? (
                <ImageViewer
                  key={image._id + (Array.isArray(image.likes) ? image.likes.length : 0)}
                  image={image}
                  currentUser={currentUser}
                  isLiked={isLikedByCurrent}
                  onToggleLike={toggleLikeOnServer}
                  showClose={false}
                />
              ) : null}

              <button
                type="button"
                aria-label="上一張"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate ? onNavigate("prev") : onClose?.();
                }}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >
                ←
              </button>

              <button
                type="button"
                aria-label="下一張"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate ? onNavigate("next") : onClose?.();
                }}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >
                →
              </button>

              <button
                type="button"
                aria-label="關閉"
                title="Esc 關閉"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackdropClick();
                }}
                className="hidden md:flex absolute top-3 right-3 items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-xl"
              >
                ✕
              </button>
            </div>

            <DesktopRightPane
              image={image}
              currentUser={currentUser}
              isFollowing={isFollowing}
              onFollowToggle={handleFollowToggle}
              onUserClick={handleUserClick}
              onClose={handleBackdropClick}
              onDelete={handleDelete}
              canEdit={canEdit}
              onEdit={openEdit}   // ← 傳給右欄，讓鉛筆按鈕可以打開編輯彈窗
              onPowerCouponUse={handlePowerCouponUse}
            />
          </div>

          {/* 編輯彈窗：使用你的現成元件 */}
          <EditImageModal
            imageId={image?._id}
            isOpen={isEditOpen}
            onClose={closeEdit}
            onImageUpdated={handleEditUpdated}
          />

          {/* 權力券選擇彈窗 */}
          {isPowerCouponModalOpen && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsPowerCouponModalOpen(false)}
              />
              <div className="relative bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold text-white mb-4">選擇權力券</h3>
                
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                  {(() => {
                    // 合併相同類型的券
                    const groupedCoupons = {};
                    availableCoupons.forEach(coupon => {
                      const key = coupon.type;
                      if (!groupedCoupons[key]) {
                        groupedCoupons[key] = {
                          type: coupon.type,
                          coupons: [],
                          count: 0
                        };
                      }
                      groupedCoupons[key].coupons.push(coupon);
                      groupedCoupons[key].count++;
                    });

                    return Object.values(groupedCoupons).map((group, index) => (
                      <div
                        key={group.type}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedCouponId && group.coupons.some(c => c._id === selectedCouponId)
                            ? "bg-purple-700 border-purple-500"
                            : "bg-zinc-700 border-zinc-600 hover:bg-zinc-600"
                        }`}
                        onClick={() => {
                          // 選擇該組的第一張券
                          setSelectedCouponId(group.coupons[0]._id);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {/* 權力券圖示 */}
                            <div className="text-2xl">🎫</div>
                            <div>
                              <p className="font-medium text-white">
                                {group.type === '7day' ? '7天曝光加成券' : 
                                 group.type === '30day' ? '30天曝光加成券' : 
                                 group.type === 'rare' ? '稀有曝光加成券' : group.type}
                                {group.count > 1 && (
                                  <span className="ml-2 bg-yellow-600 text-yellow-100 text-xs px-2 py-1 rounded-full">
                                    x{group.count}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">
                                購買日期: {new Date(group.coupons[0].createdAt).toLocaleDateString()}
                              </p>
                              {group.coupons[0].expiry && (
                                <p className="text-xs text-gray-400">
                                  過期日期: {new Date(group.coupons[0].expiry).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {selectedCouponId && group.coupons.some(c => c._id === selectedCouponId) && (
                            <span className="text-green-400 text-sm">已選擇</span>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsPowerCouponModalOpen(false)}
                    className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmUseCoupon}
                    disabled={!selectedCouponId || isUsingCoupon}
                    className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                      !selectedCouponId || isUsingCoupon
                        ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700 text-white"
                    }`}
                  >
                    {isUsingCoupon ? "使用中..." : "確認使用"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

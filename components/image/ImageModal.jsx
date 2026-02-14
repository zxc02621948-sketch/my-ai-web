"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import MobileImageSheet from "@/components/image/MobileImageSheet";
import DesktopRightPane from "@/components/image/DesktopRightPane";
import axios from "axios";
import { getLikesFromCache, updateLikeCacheAndBroadcast } from "@/lib/likeSync";
import EditImageModal from "@/components/image/EditImageModal"; // ← 你的編輯彈窗
import { notify } from "@/components/common/GlobalNotificationManager";
import { trackEvent } from "@/utils/analyticsQueue";

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
  displayMode = "gallery", // ✅ 新增：顯示模式（'gallery' 或 'collection'）
  onLikeUpdate,
  onNavigate,
  onFollowChange,     // 父層回寫 currentUser.following
  followOverrides,    // Map: userId -> boolean（前端優先）
  onImageUpdated,     // 可選：讓父層也能接到「已更新」
}) {
  const router = useRouter();
  const followLockRef = useRef(false);
  const viewedRef = useRef(new Set());
  const modalOpenTimeRef = useRef(null);

  // ---- 先定義 state，再根據 state 推導 currentId（修復點） ----
  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLikeProcessing, setIsLikeProcessing] = useState(false);

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
    // ✅ 如果 imageData 沒有 originalImageUrl，即使有 _id 也要去 API 獲取完整數據
    if (imageData?._id) {
      // 如果 imageData 已經有 originalImageUrl，直接使用（避免不必要的 API 調用）
      if (imageData.originalImageUrl) {
        setImage(imageData);
        setLoading(false);
        setError(null);
        return;
      }
      // 如果沒有 originalImageUrl，去 API 獲取完整數據
      // 繼續執行下面的 API 調用邏輯
    }
    // ✅ 檢查 imageData 是否為音樂或視頻類型，如果是則不調用圖片 API
    if (imageData?.type === 'music' || imageData?.type === 'video') {
      // 音樂和視頻不應該進入 ImageModal，應該由父組件處理
      return;
    }
    
    if (!imageId && !imageData?._id) return;

    let alive = true;
    let controller = null;
    (async () => {
      setLoading(true);
      try {
        // ✅ 添加超時控制，避免長時間等待
        controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
        
        // ✅ 使用 imageId 或 imageData._id
        const targetId = imageId || imageData?._id;
        const res = await fetch(`/api/images/${targetId}`, { 
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        if (!res.ok) throw new Error("找不到該圖片，可能已被刪除");
        if (alive) {
          console.log("📥 ImageModal 從 API 獲取圖片數據:", {
            imageId: targetId,
            hasOriginalImageUrl: !!data.image?.originalImageUrl,
            originalImageUrl: data.image?.originalImageUrl,
          });
          setImage(data.image);
          setError(null);
        }
      } catch (err) {
        // ✅ 忽略被取消的請求（AbortError），這是正常的清理行為
        if (alive && err.name !== 'AbortError') {
          setError(err.message || "載入失敗");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      // ✅ 清理時取消正在進行的請求
      if (controller) {
        controller.abort();
      }
    };
  }, [imageId, imageData?._id]); // ✅ 只依賴 imageId 和 imageData._id，避免對象引用變化導致重複請求

  // ✅ 每次「切換到新圖片」時，呼叫一次點擊 API，並把回傳寫回本地 state
  useEffect(() => {
    if (!currentId) return;

    // 避免同一張在同一次開啟中被重複計分
    if (viewedRef.current.has(currentId)) return;
    viewedRef.current.add(currentId);

    // ✅ 圖片分析：追蹤打開 Modal 事件
    trackEvent('image', {
      imageId: currentId,
      eventType: 'open_modal',
    });
    
    // ✅ 記錄打開時間，用於計算停留時間
    modalOpenTimeRef.current = Date.now();

    fetch(`/api/images/${currentId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok) return;
        // 把 server 更新後的 clicks / likesCount / popScore 回寫到當前 image
        setImage((prev) =>
          prev && String(prev._id) === String(currentId)
            ? {
                ...prev,
                clicks: data.clicks ?? prev.clicks,
                viewCount: data.viewCount ?? prev.viewCount,
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
  }, [image?._id, imageId, imageData?._id]);

  // ✅ 優化：若 user 是字串 → 補抓作者物件
  // 只在必要時調用 API，避免重複請求
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    
    // 如果 user 已經是對象，不需要再次請求
    if (u && typeof u === "object" && u._id) return;
    
    // 如果 user 是字符串，才需要補抓
    if (!u || typeof u !== "string") return;

    let alive = true;
    (async () => {
      try {
        // ✅ 直接調用 user API，避免重複調用圖片詳情 API
        // 因為圖片詳情 API 已經在第一次加載時調用過了
        const r = await fetch(`/api/user/${u}`, { cache: "no-store" });
        if (r.ok && alive) {
          const data = await r.json();
          const userObj = data?.user || data?.data || null;
          if (userObj && typeof userObj === "object") {
            setImage((prev) => (prev ? { ...prev, user: userObj } : prev));
          }
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [image?._id, image?.user, image?.userId]); // ✅ 優化依賴項，避免不必要的觸發

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
      if (next) {
        await axios.post(
          "/api/follow",
          { userIdToFollow: ownerId },
          { withCredentials: true }
        );
      } else {
        await axios.delete("/api/follow", {
          data: { userIdToUnfollow: ownerId },
          withCredentials: true,
        });
      }

      // 成功：通知父層同步 currentUser.following + 覆蓋表
      onFollowChange?.(String(ownerId), next);
    } catch (e) {
      // 失敗還原
      setIsFollowing(!next);
      console.error("❌ 追蹤切換失敗", e);
      notify.error("操作失敗", "追蹤狀態更新失敗，請稍後再試");
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
    const confirmed = await notify.confirm("確認刪除", "你確定要刪除這張圖片嗎？");
    if (!confirmed) return;
    try {
      const res = await fetch("/api/delete-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id }),
      });
      if (!res.ok) throw new Error("刪除失敗");
      // 將成功狀態保存到 sessionStorage，刷新後顯示提示
      if (typeof window !== "undefined") {
        sessionStorage.setItem("imageDeletedSuccess", JSON.stringify({
          title: "成功",
          message: "圖片刪除成功！"
        }));
      }
      window.location.reload();
      onClose?.();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      notify.error("刪除失敗", "請稍後再試。");
    }
  };

  // 加成券使用成功回調
  const handlePowerCouponSuccess = () => {
    // 刷新圖片數據
    window.location.reload();
  };

  // Like
  const isLikedByCurrent =
    Array.isArray(image?.likes) && currentUser?._id
      ? image.likes.some((id) => String(id) === String(currentUser._id))
      : false;

  const toggleLikeOnServer = async () => {
    try {
      if (isLikeProcessing) return;
      if (!currentUser?._id || !image?._id) return;
      setIsLikeProcessing(true);
      const res = await fetch(`/api/like-image?id=${image._id}`, {
        method: "PUT",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const likesArr = Array.isArray(data.likes) ? data.likes : image.likes || [];
        const updated = { ...image, likes: likesArr, likesCount: likesArr.length };
        setImage(updated);
        onLikeUpdate?.(updated);
        updateLikeCacheAndBroadcast(updated);
        // 廣播目前登入者積分（若後端有提供）
        const balance = data?.currentUserPointsBalance;
        const uid = currentUser?._id || currentUser?.id;
        if (typeof balance === "number" && uid) {
          window.dispatchEvent(new CustomEvent("points-updated", { detail: { userId: String(uid), pointsBalance: Number(balance) } }));
        }
      }
    } catch (err) {
      console.error("❌ 點讚失敗", err);
      notify.error("操作失敗", "點讚失敗，請稍後再試");
    } finally {
      // 與縮圖一致：保留 1 秒防連點冷卻
      setTimeout(() => setIsLikeProcessing(false), 1000);
    }
  };

  function handleBackdropClick() {
    // ✅ 圖片分析：追蹤離開事件
    if (currentId && modalOpenTimeRef.current) {
      const timeSpent = (Date.now() - modalOpenTimeRef.current) / 1000;
      trackEvent('image', {
        imageId: currentId,
        eventType: 'exit',
        timeSpent: Math.round(timeSpent),
        exitPoint: window.location.pathname,
      });
      modalOpenTimeRef.current = null;
    }
    
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  }

  // ✅ 檢測是否是移動設備
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
          {/* ✅ 優化：使用條件渲染，避免同時渲染兩個組件導致重複API調用 */}
          {isMobile ? (
            <MobileImageSheet
              image={image}
              prevImage={prevImage}
              nextImage={nextImage}
              loading={loading}
              error={error}
              currentUser={currentUser}
              displayMode={displayMode} // ✅ 傳遞顯示模式
              isFollowing={isFollowing}
              onFollowToggle={handleFollowToggle}
              onUserClick={handleUserClick}
              onToggleLike={toggleLikeOnServer}
              onLikeUpdate={onLikeUpdate}
              onClose={handleBackdropClick}
              onNavigate={onNavigate}
            />
          ) : (
            <div className="flex flex-row w-full">
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
              displayMode={displayMode} // ✅ 傳遞顯示模式
              isFollowing={isFollowing}
              onFollowToggle={handleFollowToggle}
              onUserClick={handleUserClick}
              onClose={handleBackdropClick}
              onDelete={handleDelete}
              canEdit={canEdit}
              onEdit={openEdit}   // ← 傳給右欄，讓鉛筆按鈕可以打開編輯彈窗
              onPowerCouponSuccess={handlePowerCouponSuccess}
            />
          </div>
          )}

          {/* 編輯彈窗：使用你的現成元件 */}
          <EditImageModal
            imageId={image?._id}
            isOpen={isEditOpen}
            onClose={closeEdit}
            onImageUpdated={handleEditUpdated}
          />

        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

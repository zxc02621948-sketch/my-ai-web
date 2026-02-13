"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import Link from "next/link";
import {
  Heart,
  Info,
  Loader2,
  ShieldAlert,
  User,
  X,
} from "lucide-react";

const CF_IMAGE_BASE = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A";

function resolveImageUrl(image) {
  if (!image) return "";
  if (image.imageUrl) return image.imageUrl;
  if (image.imageId) {
    const variant = image.variant || "public";
    return `${CF_IMAGE_BASE}/${image.imageId}/${variant}`;
  }
  if (Array.isArray(image.files) && image.files[0]?.url) {
    return image.files[0].url;
  }
  return "";
}

function getAuthorName(image) {
  if (!image) return "匿名創作者";
  const userObj =
    typeof image.user === "object" && image.user ? image.user : null;
  if (userObj) {
    return (
      userObj.nickname ||
      userObj.displayName ||
      userObj.username ||
      userObj.name ||
      "匿名創作者"
    );
  }
  if (typeof image.username === "string" && image.username.trim()) {
    return image.username.trim();
  }
  if (typeof image.author === "string" && image.author.trim()) {
    return image.author.trim();
  }
  return "匿名創作者";
}

export default function ShowcaseImageModal({
  imageId,
  isOpen,
  onClose,
  onExpand,
  currentUser,
}) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    if (!isOpen || !imageId) {
      setImage(null);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/images/${imageId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("載入圖片資料失敗");
        }
        const data = await res.json();
        if (!alive) return;
        setImage(data?.image || null);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "載入圖片資料失敗");
        setImage(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [imageId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [isOpen]);

  const isLiked = useMemo(() => {
    if (!image?.likes) return false;
    if (!currentUser?._id && !currentUser?.id) return false;
    const uid = String(currentUser?._id || currentUser?.id);
    return image.likes.some((likeId) => String(likeId) === uid);
  }, [image?.likes, currentUser]);

  const likesCount = useMemo(() => {
    if (typeof image?.likesCount === "number") return image.likesCount;
    if (Array.isArray(image?.likes)) return image.likes.length;
    return 0;
  }, [image?.likes, image?.likesCount]);

  const handleToggleLike = useCallback(async () => {
    if (!image?._id || !currentUser?._id) return;
    if (isLiking) return;
    setIsLiking(true);
    const nextLiked = !isLiked;
    const uid = String(currentUser?._id || currentUser?.id);

    setImage((prev) => {
      if (!prev) return prev;
      const likesArr = Array.isArray(prev.likes) ? [...prev.likes] : [];
      const idx = likesArr.findIndex((id) => String(id) === uid);
      if (nextLiked && idx === -1) likesArr.push(uid);
      if (!nextLiked && idx !== -1) likesArr.splice(idx, 1);
      return {
        ...prev,
        likes: likesArr,
        likesCount: likesArr.length,
      };
    });

    try {
      await fetch(`/api/like-image?id=${image._id}`, {
        method: "PUT",
        credentials: "include",
      });
    } catch (err) {
      console.error("❌ 點讚失敗", err);
      setImage((prev) => {
        if (!prev) return prev;
        const likesArr = Array.isArray(prev.likes) ? [...prev.likes] : [];
        const idx = likesArr.findIndex((id) => String(id) === uid);
        if (nextLiked && idx !== -1) likesArr.splice(idx, 1);
        if (!nextLiked && idx === -1) likesArr.push(uid);
        return {
          ...prev,
          likes: likesArr,
          likesCount: likesArr.length,
        };
      });
    } finally {
      setIsLiking(false);
    }
  }, [currentUser?._id, currentUser?.id, image?._id, isLiked, isLiking]);

  const handleExpand = useCallback(() => {
    if (!image) return;
    onExpand?.(image);
  }, [image, onExpand]);

  const authorName = useMemo(() => getAuthorName(image), [image]);
  const authorId = useMemo(() => {
    const userObj =
      typeof image?.user === "object" && image?.user ? image.user : null;
    return userObj?._id || image?.userId || null;
  }, [image]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100000]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative flex min-h-[300px] w-full items-center justify-center bg-black/80">
                  {loading ? (
                    <div className="flex aspect-[4/3] w-full max-w-3xl items-center justify-center text-zinc-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : error ? (
                    <div className="flex aspect-[4/3] w-full max-w-3xl flex-col items-center justify-center gap-3 text-center text-sm text-rose-200">
                      <ShieldAlert className="h-10 w-10" />
                      <p>{error}</p>
                    </div>
                  ) : image ? (
                    <div className="relative w-full">
                      <img
                        src={resolveImageUrl(image) || "/default-image.svg"}
                        alt={image.title || "圖片"}
                        className="mx-auto w-full max-h-[80vh] object-contain"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent px-5 pb-4 pt-10">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-white">
                              {image.title || "AI 圖像作品"}
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-200">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                                <User className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {authorName}
                                </p>
                                {authorId ? (
                                  <Link
                                    href={`/user/${authorId}`}
                                    className="text-[11px] text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
                                    onClick={onClose}
                                  >
                                    查看作者頁面
                                  </Link>
                                ) : (
                                  <p className="text-[11px] text-zinc-400">
                                    作者資訊尚未提供
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleToggleLike}
                              disabled={!currentUser?._id || !image || isLiking}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                                isLiked
                                  ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                                  : "bg-white/10 text-white hover:bg-white/20"
                              } ${!currentUser?._id ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              <Heart
                                className={`h-4 w-4 ${isLiked ? "fill-rose-400 text-rose-400" : ""}`}
                              />
                              <span>{likesCount}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleExpand}
                              disabled={!image}
                              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/80 to-teal-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Info className="h-4 w-4" />
                              查看完整資訊
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] w-full max-w-3xl items-center justify-center text-zinc-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}


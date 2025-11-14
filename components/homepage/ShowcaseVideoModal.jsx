"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import Link from "next/link";
import {
  Clock,
  Heart,
  Info,
  User,
  VideoIcon,
  X,
} from "lucide-react";

const CF_IMAGE_BASE = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A";

function resolveThumbnail(video) {
  if (!video) return "";
  if (video.thumbnail) return video.thumbnail;
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.previewUrl) return video.previewUrl;
  if (Array.isArray(video.previewImages)) return video.previewImages[0] || "";
  if (video.coverImageUrl) return video.coverImageUrl;
  if (video.cover) return video.cover;
  return "";
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getAuthorName(video) {
  if (!video) return "匿名創作者";
  const authorObj =
    typeof video.author === "object" && video.author ? video.author : null;
  if (authorObj) {
    return (
      authorObj.nickname ||
      authorObj.displayName ||
      authorObj.username ||
      "匿名創作者"
    );
  }
  return (
    video.displayAuthor ||
    video.authorName ||
    video.author ||
    "匿名創作者"
  );
}

export default function ShowcaseVideoModal({
  video,
  isOpen,
  onClose,
  onExpand,
  onToggleLike,
  currentUser,
}) {
  const videoId = video?._id || video?.id || null;
  const authorId = useMemo(() => {
    const authorObj =
      typeof video?.author === "object" && video?.author ? video.author : null;
    return authorObj?._id || video?.author?._id || video?.authorId || null;
  }, [video]);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    const uid = currentUser?._id || currentUser?.id;
    const likesArr = Array.isArray(video?.likes) ? video.likes : [];
    setIsLiked(
      !!uid && likesArr.some((id) => String(id) === String(uid)),
    );
    setLikesCount(
      typeof video?.likesCount === "number"
        ? video.likesCount
        : likesArr.length,
    );
  }, [video, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [isOpen]);

  const title = video?.displayTitle || video?.title || "AI 影片作品";
  const authorName = getAuthorName(video);
  const durationLabel = formatDuration(video?.duration);
  const thumbnail = resolveThumbnail(video);

  const renderVideo = () => {
    if (video?.streamId) {
      return (
        <iframe
          src={`https://iframe.cloudflarestream.com/${video.streamId}?autoplay=true&muted=true&loop=true`}
          className="h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title={title}
        />
      );
    }

    if (video?.videoUrl) {
      return (
        <video
          key={video.videoUrl}
          src={video.videoUrl}
          className="h-full w-full object-contain"
          autoPlay
          muted
          loop
          controls
          playsInline
        />
      );
    }

    if (thumbnail) {
      return (
        <img
          src={
            thumbnail.startsWith("http")
              ? thumbnail
              : `${CF_IMAGE_BASE}/${thumbnail}/public`
          }
          alt={title}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      );
    }

    return (
      <div className="flex aspect-[16/9] w-full max-w-3xl items-center justify-center bg-gradient-to-br from-sky-500/40 to-emerald-500/30 text-sky-100">
        <VideoIcon className="h-14 w-14" />
      </div>
    );
  };

  const handleLikeClick = async () => {
    if (!videoId || !onToggleLike || !currentUser?._id) return;
    const result = await onToggleLike(videoId);
    if (result?.likes) {
      const uid = currentUser?._id || currentUser?.id;
      setIsLiked(result.likes.some((id) => String(id) === String(uid)));
      setLikesCount(result.likes.length);
    }
  };

  const handleExpand = () => {
    if (!video) return;
    onExpand?.(video);
  };

  if (!video || !isOpen) {
    return null;
  }

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
                  <div className="mx-auto flex w-full max-h-[80vh] items-center justify-center">
                    <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl bg-black/80">
                      {renderVideo()}
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent px-5 pb-4 pt-12">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-200">
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
                          {durationLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px]">
                              <Clock className="h-3.5 w-3.5" />
                              {durationLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleLikeClick}
                          disabled={!currentUser?._id || !videoId}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                            isLiked
                              ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                              : "bg-white/10 text-white hover:bg-white/20"
                          } ${!currentUser?._id ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              isLiked ? "fill-rose-400 text-rose-400" : ""
                            }`}
                          />
                          <span>{likesCount}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExpand}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500/80 to-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-500 hover:to-emerald-500"
                        >
                          <Info className="h-4 w-4" />
                          查看完整資訊
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}


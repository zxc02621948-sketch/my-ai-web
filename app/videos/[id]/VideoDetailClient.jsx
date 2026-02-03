"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import VideoModal from "@/components/video/VideoModal";

export default function VideoDetailClient({ videoData, currentUser }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [videoState, setVideoState] = useState(videoData);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setVideoState(videoData);
  }, [videoData]);

  const handleClose = () => {
    router.push("/videos"); // Navigate back to the video list page
  };

  const handleToggleLike = async (videoId) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state
        setVideoState((prev) =>
          prev && prev._id === videoId
            ? {
                ...prev,
                likes: data.likes,
                likesCount: data.likes.length,
              }
            : prev
        );
      }
    } catch (error) {
      console.error("切換點讚狀態失敗:", error);
    }
  };

  if (!mounted || !videoState) {
    return null;
  }

  const isLiked =
    Array.isArray(videoState?.likes) && currentUser?._id
      ? videoState.likes.includes(currentUser._id)
      : false;

  return (
    <VideoModal
      video={videoState}
      currentUser={currentUser}
      displayMode="gallery"
      onClose={handleClose}
      onUserClick={() => {
        const authorId = videoState?.author?._id || videoState?.author;
        if (authorId) {
          router.push(`/user/${authorId}`);
        }
      }}
      onDelete={async (videoId) => {
        try {
          const response = await fetch(`/api/videos/${videoId}/delete`, {
            method: "DELETE",
            credentials: "include",
          });

          if (response.ok) {
            router.push("/videos");
          } else {
            const error = await response.json();
            console.error("刪除影片失敗:", error);
          }
        } catch (error) {
          console.error("刪除影片錯誤:", error);
        }
      }}
      canEdit={
        currentUser &&
        videoState?.author?._id &&
        String(currentUser._id) === String(videoState.author._id)
      }
      onEdit={() => {
        // Edit functionality can be added here if needed
        console.log("Edit video:", videoState._id);
      }}
      isLiked={isLiked}
      onToggleLike={handleToggleLike}
    />
  );
}


"use client";

import React, { useEffect, useRef } from "react";
import ImageCard from "./ImageCard";

export default function ImageGrid({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
  viewMode,
}) {
  const list = images?.length ? images : (filteredImages || []);
  const gridRef = useRef(null);
  const msnryRef = useRef(null);
  const ilRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!gridRef.current) return;
      const [{ default: Masonry }, { default: imagesLoaded }] = await Promise.all([
        import("masonry-layout"),
        import("imagesloaded"),
      ]);
      if (!mounted || !gridRef.current) return;

      if (msnryRef.current) { msnryRef.current.destroy(); msnryRef.current = null; }
      if (ilRef.current) { try { ilRef.current.off("progress"); } catch {} ilRef.current = null; }

      msnryRef.current = new Masonry(gridRef.current, {
        itemSelector: ".grid-item",
        columnWidth: ".grid-sizer",
        percentPosition: true,
        gutter: 12,
        horizontalOrder: true,
        transitionDuration: "0.2s",
      });

      ilRef.current = imagesLoaded(gridRef.current);
      ilRef.current.on("progress", () => { msnryRef.current && msnryRef.current.layout(); });

      msnryRef.current.layout();
    })();

    return () => {
      mounted = false;
      if (ilRef.current) { try { ilRef.current.off("progress"); } catch {} ilRef.current = null; }
      if (msnryRef.current) { msnryRef.current.destroy(); msnryRef.current = null; }
    };
  }, [list]);

  if (!list?.length) return null;

  return (
    <div className="w-full px-3 md:px-4 mx-auto box-border">
      <div ref={gridRef} className="my-masonry">
        {/* 只提供寬度參考，不要放內容 */}
        <div className="grid-sizer" />
        {list.map((img, i) => (
          <div key={img._id || i} className="grid-item">
            <div className="card-wrap">
              <ImageCard
                img={img}
                viewMode={viewMode}
                currentUser={currentUser}
                isLiked={isLikedByCurrentUser?.(img)}
                onClick={() => onSelectImage?.(img)}
                onToggleLike={() => onToggleLike?.(img._id)}
                onLocalLikeChange={onLocalLikeChange}
              />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        /* 把 gutter 變數掛在容器本身（styled-jsx 作用域內可被子元素取到） */
        .my-masonry { --g: 12px; }

        /* 手機：2 欄（1 個縫隙） */
        .my-masonry .grid-sizer,
        .my-masonry .grid-item {
          width: calc((100% - var(--g)) / 2);
          box-sizing: border-box;
        }
        .my-masonry .card-wrap { margin-bottom: var(--g); }

        /* md ≥ 768px：3 欄（2 個縫隙） */
        @media (min-width: 768px) {
          .my-masonry .grid-sizer,
          .my-masonry .grid-item {
            width: calc((100% - 2 * var(--g)) / 3);
          }
        }

        /* lg ≥ 1024px：5 欄（4 個縫隙） */
        @media (min-width: 1024px) {
          .my-masonry .grid-sizer,
          .my-masonry .grid-item {
            width: calc((100% - 4 * var(--g)) / 5);
          }
        }
      `}</style>
    </div>
  );
}

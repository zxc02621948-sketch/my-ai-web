"use client";

import React, { useEffect, useRef } from "react";
import ImageCard from "./ImageCard";

// 單例載入
let libsPromise;
function loadMasonryLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all([
      import("masonry-layout").then((m) => m.default),
      import("imagesloaded").then((m) => m.default),
    ]);
  }
  return libsPromise;
}

export default function ImageGrid({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
  viewMode,
  gutter = 13, // ⬅️ 調這個就能改縫隙（px）
}) {
  const list = images?.length ? images : filteredImages || [];
  const gridRef = useRef(null);
  const msnryRef = useRef(null);
  const ilRef = useRef(null);

  // 初始化（一次）
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [Masonry, imagesLoaded] = await loadMasonryLibs();
      if (!mounted || !gridRef.current) return;

      msnryRef.current = new Masonry(gridRef.current, {
        itemSelector: ".grid-item",
        columnWidth: ".grid-sizer",
        percentPosition: true,
        gutter,               // ⬅️ JS 端間距
        horizontalOrder: true,
        transitionDuration: "0.2s",
      });

      ilRef.current = imagesLoaded(gridRef.current);
      ilRef.current.on("progress", () => msnryRef.current?.layout());
      msnryRef.current.layout();
    })();

    return () => {
      mounted = false;
      try { ilRef.current?.off("progress"); } catch {}
      ilRef.current = null;
      msnryRef.current?.destroy();
      msnryRef.current = null;
    };
  }, [gutter]);

  // 清單變動只重排
  useEffect(() => {
    (async () => {
      const [, imagesLoaded] = await loadMasonryLibs();
      if (!gridRef.current || !msnryRef.current) return;

      try { ilRef.current?.off("progress"); } catch {}
      ilRef.current = imagesLoaded(gridRef.current);
      ilRef.current.on("progress", () => msnryRef.current?.layout());

      msnryRef.current.reloadItems();
      msnryRef.current.layout();
    })();
  }, [list]);

  if (!list?.length) return null;

  return (
    <div className="w-full px-3 md:px-4 mx-auto box-border">
      <div
        ref={gridRef}
        className="my-masonry"
        style={{ ["--g"]: `${gutter}px` }} // ⬅️ CSS 端間距
      >
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
        .my-masonry { position: relative; }
        /* Masonry 未初始化前的 fallback：float 多欄 */
        .my-masonry .grid-sizer,
        .my-masonry .grid-item { float: left; }
        .my-masonry::after { content: ""; display: block; clear: both; }

        /* 將下方間距給 grid-item，與 Masonry 絕對定位相容 */
        .my-masonry .grid-item { margin-bottom: var(--g); }

        /* 手機：2 欄（1 縫） */
        .my-masonry .grid-sizer,
        .my-masonry .grid-item {
          width: calc((100% - var(--g)) / 2);
          box-sizing: border-box;
        }

        /* md：3 欄（2 縫） */
        @media (min-width: 768px) {
          .my-masonry .grid-sizer,
          .my-masonry .grid-item {
            width: calc((100% - 2 * var(--g)) / 3);
          }
        }

        /* lg：5 欄（4 縫） */
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

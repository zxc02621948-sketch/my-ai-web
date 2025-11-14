'use client';

import React, { useEffect, useState } from "react";
import MusicPreview from "./MusicPreview";

export default function MusicGrid({ music = [], onSelectMusic }) {
  const [columns, setColumns] = useState(5);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1536) {
        setColumns(6);
      } else if (width >= 1280) {
        setColumns(5);
      } else if (width >= 1024) {
        setColumns(4);
      } else if (width >= 768) {
        setColumns(3);
      } else {
        setColumns(2);
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  if (!music || music.length === 0) return null;

  if (!isClient) {
    return (
      <div className="music-grid-container">
        <div className="music-grid">
          {music.map((track) => (
            <div key={track._id} className="grid-item">
              <MusicPreview music={track} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sortedMusic = [...music].sort((a, b) => {
    const scoreA = typeof a.livePopScore === "number" ? a.livePopScore : 0;
    const scoreB = typeof b.livePopScore === "number" ? b.livePopScore : 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    const idA = (a._id || a.id || "").toString();
    const idB = (b._id || b.id || "").toString();
    return idB.localeCompare(idA);
  });

  return (
    <div className="music-grid-container">
      <style jsx>{`
        .music-grid-container {
          padding: 10px;
        }

        .music-grid {
          display: grid;
          grid-template-columns: repeat(${columns}, minmax(0, 1fr));
          gap: 16px;
          max-width: 100%;
          margin: 0 auto;
        }

        .grid-item {
          width: 100%;
          overflow: hidden;
          border-radius: 12px;
          background: #27272a;
          transition: all 0.3s ease;
        }

        .grid-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(139, 92, 246, 0.3);
        }
      `}</style>

      <div className="music-grid">
        {sortedMusic.map((track) => (
          <div key={track._id} className="grid-item">
            <MusicPreview
              music={track}
              onClick={() => onSelectMusic?.(track)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

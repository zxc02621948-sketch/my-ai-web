"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { usePlayer } from "@/components/context/PlayerContext";
import dynamic from "next/dynamic";
import PlaylistModal from "@/components/player/PlaylistModal";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";

// 後備的 YouTube 內嵌播放（僅瀏覽器渲染）
const YoutubeFallback = dynamic(() => import("@/components/player/YoutubeFallback"), { ssr: false });

export default function UserPlayerPage() {
  const { id } = useParams();
  const player = usePlayer();
  const { currentUser } = useCurrentUser() || {};
  const isOwner = !!(currentUser && String(currentUser._id) === String(id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [playError, setPlayError] = useState("");
  const [showYTFallback, setShowYTFallback] = useState(false);
  const [ytVideoId, setYtVideoId] = useState("");
  const [ytPlayer, setYtPlayer] = useState(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  
  // 離開此頁面時，清除外部控制並要求全域橋接重新掛載
  useEffect(() => {
    return () => {
      try { player.setExternalControls(null); } catch {}
      try { player.setExternalPlaying(false); } catch {}
      try { player.resetExternalBridge?.(); } catch {}
    };
  }, []);


  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/user-info?id=${encodeURIComponent(id)}`);
        const u = res.data || {};
        const url = String(u.defaultMusicUrl || "");
        if (!canceled) {
          try { localStorage.setItem("miniPlayerTheme", String(u.miniPlayerTheme || "modern")); } catch {}
          player.setSource(url);
          setLink(url);
          // 播放清單初始化（localStorage 優先）
          const key = `playlist_${id}`;
          let saved = [];
          try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
          if (Array.isArray(saved) && saved.length > 0) {
            setPlaylist(saved);
            setActiveIndex(0);
            // 同步到全域 PlayerContext，讓迷你播放器支援上一/下一首與自動下一首
            try { player?.setPlaylist?.(saved); } catch {}
            try { player?.setActiveIndex?.(0); } catch {}
            try {
              const u0 = new URL(saved[0].url);
              const vid0 = u0.searchParams.get("v") || u0.pathname.split("/").filter(Boolean).pop();
              setYtVideoId(vid0 || "");
              setShowYTFallback(true);
              player.setOriginUrl(saved[0].url);
              try {
                const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(saved[0].url)}`);
                const t = o?.data?.title;
                player.setTrackTitle(t || deriveTitle(saved[0].url));
              } catch {
                player.setTrackTitle(deriveTitle(saved[0].url));
              }
            } catch {}
          } else if (url) {
            const first = { url, title: deriveTitle(url) };
            setPlaylist([first]);
            setActiveIndex(0);
            try { player?.setPlaylist?.([first]); } catch {}
            try { player?.setActiveIndex?.(0); } catch {}
            try {
              const u0 = new URL(url);
              const vid0 = u0.searchParams.get("v") || u0.pathname.split("/").filter(Boolean).pop();
              setYtVideoId(vid0 || "");
              setShowYTFallback(true);
              player.setOriginUrl(url);
              try {
                const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
                const t = o?.data?.title;
                player.setTrackTitle(t || deriveTitle(url));
              } catch {
                player.setTrackTitle(deriveTitle(url));
              }
              localStorage.setItem(key, JSON.stringify([first]));
            } catch {}
          }
        }
      } catch (e) {
        if (!canceled) setError("載入使用者音樂設定失敗");
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [id]);

  // 卸載時停止播放並清除外部控制橋接，避免返回其他頁面後迷你播放器指向已卸載的 YouTube 實例
  useEffect(() => {
    return () => {
      try { ytPlayer?.pauseVideo?.(); } catch {}
      try { player.pause(); } catch {}
      try { player.setExternalControls(null); } catch {}
      try { player.setExternalPlaying(false); } catch {}
    };
  }, []);

  const deriveTitle = (u) => {
    try {
      const test = new URL(u);
      if (/youtube\.com|youtu\.be/.test(test.hostname)) {
        const vid = test.searchParams.get("v") || test.pathname.split("/").filter(Boolean).pop();
        return vid ? `YouTube：${vid}` : "YouTube 連結";
      }
      const last = test.pathname.split("/").filter(Boolean).pop() || test.hostname;
      return decodeURIComponent(last);
    } catch {
      return u;
    }
  };

  // 將這些函式置於元件作用域，才能使用元件 state
  const savePlaylist = (next) => {
    setPlaylist(next);
    try { localStorage.setItem(`playlist_${id}`, JSON.stringify(next)); } catch {}
    try { player?.setPlaylist?.(next); } catch {}
  };

  const setCurrentByUrl = async (url) => {
    try {
      const u = new URL(url);
      const vid = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      setYtVideoId(vid || "");
      setShowYTFallback(true);
      player.setOriginUrl(url);
      try {
        const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
        const t = o?.data?.title;
        player.setTrackTitle(t || deriveTitle(url));
      } catch {
        player.setTrackTitle(deriveTitle(url));
      }
      setPlayError("");
    } catch {
      setPlayError("連結格式不正確");
    }
  };

  const nextTrack = () => {
    if (!playlist.length) return;
    const ni = (activeIndex + 1) % playlist.length;
    setActiveIndex(ni);
    try { player?.setActiveIndex?.(ni); } catch {}
    setCurrentByUrl(playlist[ni].url);
  };

  const prevTrack = () => {
    if (!playlist.length) return;
    const pi = (activeIndex - 1 + playlist.length) % playlist.length;
    setActiveIndex(pi);
    try { player?.setActiveIndex?.(pi); } catch {}
    setCurrentByUrl(playlist[pi].url);
  };

  return (
    <main className="pt-[var(--header-h,64px)] px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">播放器</h1>
        {loading ? (
          <div className="text-gray-300">載入設定中...</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col items-center justify-center p-8">
            <div className="max-w-md mx-auto text-center">
              
              {/* 播放清單設定入口（僅作者本人可見） */}
              {isOwner ? (
                <div className="mb-8 w-full max-w-md mx-auto">
                  <label className="block text-sm text-gray-300 mb-2">播放清單（最多 5 首）</label>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">目前曲目：{playlist.length} 首</div>
                    <button
                      onClick={() => setModalOpen(true)}
                      className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/30 text-white transition-colors"
                    >
                      設定清單
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 break-all">目前來源：{player.originUrl || "未設定"}</p>
                  <p className="text-xs mt-2 text-red-400 min-h-[1em]">{playError}</p>
                  <p className="text-xs text-gray-500 mt-1">提示：目前只支援 YouTube 內嵌後備播放。</p>

                  {showYTFallback && ytVideoId ? (
                    <div className="mt-4 text-xs text-gray-300">
                      <div className="mb-2">後備方案：使用 YouTube 內嵌播放器播放音訊（頁面不顯示影片）。</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            try { ytPlayer?.pauseVideo?.(); } catch {}
                            setYtPlaying(false);
                            setShowYTFallback(false);
                            // 關閉後備時也清除外部控制，避免持續指向失效的實例
                            try { player.setExternalControls(null); } catch {}
                            try { player.setExternalPlaying(false); } catch {}
                            // 觸發橋接重置，讓全域橋接重新掛載
                            try { player.resetExternalBridge?.(); } catch {}
                          }}
                          className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/30"
                        >
                          關閉後備
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${ytVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/30"
                        >
                          直接開啟 YouTube
                        </a>
                      </div>
                      {/* 真正播放透過隱藏的內嵌元件實作 */}
                      <YoutubeFallback
                        videoId={ytVideoId}
                        onReady={(e) => {
                          try {
                            const p = e?.target;
                            setYtPlayer(p);
                            // 向全域播放器註冊外部控制，讓迷你播放器也能控制 YouTube
                            player.setExternalControls({
                              play: () => p.playVideo?.(),
                              pause: () => p.pauseVideo?.(),
                              setVolume: (v0to1) => {
                                try { p.unMute?.(); p.setVolume?.(Math.round(v0to1 * 100)); } catch {}
                              },
                              next: () => nextTrack(),
                              prev: () => prevTrack(),
                            });
                            // 註冊外部控制後，先暫停本地 Audio，避免重疊或狀態錯亂
                            try { player.pause(); } catch {}
                            const st = p?.getPlayerState?.();
                            const playing = st === 1;
                            setYtPlaying(playing);
                            player.setExternalPlaying(playing);
                            // 同步 YouTube 當前音量到全域 PlayerContext，避免滑桿與實際音量不一致
                            try {
                              const muted = p?.isMuted?.();
                              const vol = typeof p?.getVolume === 'function' ? Number(p.getVolume()) : 100;
                              const v01 = Math.max(0, Math.min(1, (muted ? 0 : vol) / 100));
                              player.setVolume(v01);
                            } catch {}
                          } catch {}
                        }}
                        onStateChange={(evt) => {
                          try {
                            const code = evt?.data;
                            // YouTube 狀態碼：0=結束，1=播放，2=暫停，3=緩衝，5=影片已載入
                            if (code === 0) {
                              // 當一首歌播放完畢，切到下一首
                              nextTrack();
                            }
                            const playing = code === 1;
                            setYtPlaying(playing);
                            player.setExternalPlaying(playing);
                          } catch {}
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mb-8 w-full max-w-md mx-auto">
                  <p className="text-xs text-gray-400 mt-2 break-all">目前來源：{player.originUrl || "未設定"}</p>
                </div>
              )}

            {/* 主視覺：採用 SVG 佈景並依播放狀態旋轉 */}
            <div className="flex justify-center mb-12">
              <div
                className="drop-shadow-2xl"
                style={{ width: "200px", height: "200px", transform: "scale(1.4286)", transformOrigin: "top left" }}
                aria-label="Mini Player Art"
              >
                {/* 使用共用的 SVG 佈景，播放時唱片旋轉 */}
                <MiniPlayerArt
                  isPlaying={player.isPlaying}
                  palette={{ bg: "#F8F1E4", border: "#F8F1E4", accent1: "#E67E22", accent2: "#D35400" }}
                />
              </div>
            </div>

              {/* 播放控制區 - 無外框 */}
              <div className="space-y-6">
                {/* 取消內嵌影片，用同源音訊代理統一由內建播放器控制 */}
                {/* 播放/暫停按鈕（白色圖標） */}
                <div className="flex items-center justify-center gap-4">
                  {/* 上一首 */}
                  <button
                    onClick={() => {
                      prevTrack();
                    }}
                    className="bg-black/60 hover:bg-black/80 text-white px-4 py-3 rounded-full transition-colors backdrop-blur-sm border border-gray-600 shadow-lg flex items-center justify-center"
                    title="上一首"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                    </svg>
                  </button>
                  {/* 播放/暫停 */}
                  <button
                    onClick={async () => {
                      // 透過全域 PlayerContext 控制；若有外部控制則自動委派
                      try {
                        if (player.isPlaying) {
                          await player.pause();
                        } else {
                          const ok = await player.play();
                          if (!ok) setPlayError("尚未設定 YouTube 連結或尚未載入播放器。");
                        }
                      } catch {}
                    }}
                    className="bg-black/70 hover:bg-black/90 text-white px-8 py-4 rounded-full transition-colors backdrop-blur-sm border border-gray-600 shadow-lg flex items-center justify-center"
                    title={player.isPlaying ? "暫停" : "播放"}
                  >
                    {player.isPlaying ? (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  {/* 下一首 */}
                  <button
                    onClick={() => {
                      nextTrack();
                    }}
                    className="bg-black/60 hover:bg-black/80 text-white px-4 py-3 rounded-full transition-colors backdrop-blur-sm border border-gray-600 shadow-lg flex items-center justify-center"
                    title="下一首"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>
                </div>

                {/* 僅使用 YouTube 內嵌後備，暫不顯示進度條 */}

                {/* 音量控制 */}
                <div className="space-y-3 max-w-xs mx-auto">
                  <label className="block text-sm text-gray-400 text-center">音量</label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={player.volume}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        player.setVolume(v);
                        if (showYTFallback && ytPlayer?.setVolume) {
                          try {
                            ytPlayer.unMute?.();
                            ytPlayer.setVolume(Math.round(v * 100));
                          } catch {}
                        }
                      }}
                      className="flex-1 h-2 bg-black/50 rounded-lg appearance-none cursor-pointer backdrop-blur-sm"
                      style={{
                        background: `linear-gradient(to right, white 0%, white ${player.volume * 100}%, rgba(0,0,0,0.5) ${player.volume * 100}%, rgba(0,0,0,0.5) 100%)`
                      }}
                    />
                    <span className="text-sm text-gray-400 w-12">
                      {Math.round(player.volume * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 播放清單彈窗（僅作者本人可開啟） */}
      {isOwner ? (
        <PlaylistModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          playlist={playlist}
          onChangePlaylist={(next) => {
            savePlaylist(next);
            if (next.length > 0) {
              const idx = Math.min(activeIndex, next.length - 1);
              setActiveIndex(idx);
              setCurrentByUrl(next[idx].url);
            } else {
              setShowYTFallback(false);
              setYtVideoId("");
            }
          }}
          activeIndex={activeIndex}
          onSetActiveIndex={(i) => {
            const idx = Math.max(0, Math.min(i, playlist.length - 1));
            setActiveIndex(idx);
            if (playlist[idx]) setCurrentByUrl(playlist[idx].url);
          }}
          maxItems={5}
        />
      ) : null}
    </main>
  );
}
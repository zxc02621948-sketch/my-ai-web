"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/components/context/PlayerContext";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(check, timeoutMs = 1500, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (check()) return true; } catch {}
    await wait(intervalMs);
  }
  return false;
}

export default function PlayerSelfTestPageDup() {
  const player = usePlayer();
  const [results, setResults] = useState([]);
  const runningRef = useRef(false);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    if (typeof player?.activeIndex === 'number') {
      activeIndexRef.current = player.activeIndex;
    }
  }, [player?.activeIndex]);

  const append = (msg, ok = true) => {
    setResults((prev) => [...prev, { ok, msg }]);
  };

  const playlist = useMemo(
    () => [
      { url: "https://youtu.be/dQw4w9WgXcQ", title: "T1" },
      { url: "https://youtu.be/3GwjfUFyY6M", title: "T2" },
      { url: "https://youtu.be/oHg5SJYRHA0", title: "T3" },
    ],
    []
  );

  const setPageHidden = (hidden) => {
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    } catch {}
    try { document.dispatchEvent(new Event('visibilitychange')); } catch {}
  };

  const waitForActiveIndex = async (expectedIndex, timeoutMs = 4000) => {
    const start = Date.now();
    return new Promise((resolve) => {
      const done = (ok) => {
        try { window.removeEventListener('playerNext', onNext); } catch {}
        try { window.removeEventListener('playerPrevious', onPrev); } catch {}
        clearInterval(interval);
        resolve(!!ok);
      };
      const onNext = (e) => {
        const idx = e?.detail?.nextIndex;
        if (typeof idx === 'number' && idx === expectedIndex) return done(true);
        if (activeIndexRef.current === expectedIndex) return done(true);
      };
      const onPrev = (e) => {
        const idx = e?.detail?.prevIndex;
        if (typeof idx === 'number' && idx === expectedIndex) return done(true);
        if (activeIndexRef.current === expectedIndex) return done(true);
      };
      window.addEventListener('playerNext', onNext, { once: true });
      window.addEventListener('playerPrevious', onPrev, { once: true });
      const interval = setInterval(() => {
        if (activeIndexRef.current === expectedIndex) return done(true);
        if (Date.now() - start > timeoutMs) return done(false);
      }, 60);
    });
  };

  const endAndWait = async (expectedIndex, inBackground = false) => {
    const waiter = waitForActiveIndex(expectedIndex);
    if (inBackground) {
      player?.setAutoPlayAfterBridge?.(true);
      try { window.__PERSISTENT_AUTO_PLAY__ = true; } catch {}
    }
    player?.setExternalPlaying?.(false);
    player?.setExternalProgress?.(0, 0);
    await wait(0);
    console.log('[selftest] before next idx=', activeIndexRef.current);
    try { window.dispatchEvent(new CustomEvent('skipToNext')); } catch {}
    setTimeout(() => console.log('[selftest] after next idx=', activeIndexRef.current), 200);
    return waiter;
  };

  useEffect(() => {
    if (!player || runningRef.current) return;
    runningRef.current = true;

    (async () => {
      try {
        append("初始化播放清單", true);
        player?.setPlaylist?.(playlist);
        player?.setActiveIndex?.(0);
        player?.setTrackTitle?.(playlist[0].title);
        player?.setSrc?.(playlist[0].url);
        player?.setOriginUrl?.(playlist[0].url);
        player?.setMiniPlayerEnabled?.(true);
        // 等 Provider 實際更新後再進行切歌測試
        await waitFor(() => Array.isArray(player?.playlist) && player.playlist.length === 3, 2000);
        await waitFor(() => player?.activeIndex === 0, 1000);

        // Loop 1（正常前台播放）
        append("第一輪播放: T1", true);
        await wait(200);
        {
          const ok = await endAndWait(1);
          append(`切到 ${playlist[player.activeIndex]?.title || "?"}`, ok);
        }

        append("第一輪播放: T2", true);
        await wait(200);
        {
          const ok = await endAndWait(2);
          append(`切到 ${playlist[player.activeIndex]?.title || "?"}`, ok);
        }

        append("第一輪播放: T3", true);
        await wait(200);
        await endAndWait(0);

        await wait(100);
        const idx1 = player.activeIndex;
        append(`回到第一首檢查: index=${idx1}`, idx1 === 0);

        // Loop 2 — 背景結束 → 回前台才恢復
        append("切換為背景分頁", true);
        setPageHidden(true);

        append("第二輪播放: T1（背景中）", true);
        await wait(300);
        {
          const ok = await endAndWait(1, true);
          append(`背景中已切到 ${playlist[player.activeIndex]?.title || "?"}`, ok);
        }

        append("回到前台（觸發續播）", true);
        setPageHidden(false);
        await wait(800);
        await wait(200);
        await endAndWait(2);

        setPageHidden(true);
        append("第二輪播放: T3（背景中）", true);
        await wait(300);
        {
          const ok = await endAndWait(0, true);
          append(`背景中循環回第一首索引=${player.activeIndex}`, ok);
        }
        setPageHidden(false);
        await wait(800);

        append("第二輪回到第一首檢查: index=" + player.activeIndex, player.activeIndex === 0);
        append("背景→前台模擬: 暫停推進 2s", true);
        player?.setExternalPlaying?.(true);
        player?.setExternalProgress?.(0.5, 10);
        await wait(2000);
        append("恢復推進 1s", true);
        player?.setExternalProgress?.(1.5, 10);

        append("測試完成", true);
      } catch (e) {
        append(`測試異常: ${e?.message || e}`, false);
      }
    })();
  }, [player, playlist]);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h2 className="text-xl font-semibold mb-4">Player 自動化自測（/player-test）</h2>
      <p className="text-sm text-gray-500 mb-6">/dev/player-test 的備援路由</p>
      <ul className="space-y-2">
        {results.map((r, i) => (
          <li key={i} className={`text-sm ${r.ok ? "text-green-600" : "text-red-600"}`}>
            {r.ok ? "✓" : "✗"} {r.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}



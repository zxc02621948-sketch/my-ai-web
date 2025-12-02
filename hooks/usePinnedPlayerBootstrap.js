"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  readPinnedPlayerCache,
  writePinnedPlayerCache,
  clearPinnedPlayerCache,
  withPinnedSignature,
} from "@/utils/pinnedPlayerCache";

const debugLog = (...args) => {
  if (typeof window !== "undefined" && window.__PINNED_DEBUG__) {
    console.log("[PinnedBootstrap]", ...args);
  }
};

const isPinnedActive = (pinned) => {
  if (!pinned || !pinned.userId) {
    return false;
  }
  if (!pinned.expiresAt) {
    return true;
  }
  try {
    return new Date(pinned.expiresAt) > new Date();
  } catch {
    return false;
  }
};

const normalizePinned = (raw) => {
  if (!raw) {
    return null;
  }
  const allowShuffle =
    typeof raw.allowShuffle === "boolean" ? raw.allowShuffle : null;
  return {
    ...raw,
    allowShuffle,
    playlist: Array.isArray(raw.playlist) ? raw.playlist : [],
  };
};

const idsEqual = (a, b) => {
  if (!a || !b) {
    return false;
  }
  return String(a) === String(b);
};

const defaultOptions = {
  shareMode: "global",
  skipSelfPlaylist: true,
  disableOnUnpinned: false,
};

const resetPlayerWhenUnpinned = (player, shareMode) => {
  player?.setMiniPlayerEnabled?.(false);
  player?.pause?.();
  player?.setExternalControls?.(null);
  player?.setExternalPlaying?.(false);
  player?.setShareMode?.(shareMode);
  player?.setPinnedOwnerInfo?.(null);
  clearPinnedPlayerCache();
};

export default function usePinnedPlayerBootstrap({
  player,
  currentUser,
  shareMode = defaultOptions.shareMode,
  skipSelfPlaylist = defaultOptions.skipSelfPlaylist,
  disableOnUnpinned = defaultOptions.disableOnUnpinned,
} = {}) {
  const lastAppliedRef = useRef(null);
  const lastShufflePreferenceRef = useRef(null);
  const bootstrapExecutedRef = useRef(false); // 追踪是否已執行過 bootstrap，避免重複執行
  const lastPinnedSignatureRef = useRef(null); // 追踪上次的 pinned 簽名，避免重複執行
  const pathname = usePathname();
  
  // ✅ 檢查當前是否在用戶頁面（用戶頁面會自己管理播放器啟用狀態）
  const isUserPage = pathname?.startsWith("/user/") && pathname !== "/user/following";

  const applyPinnedState = useCallback(
    (rawPinned) => {
      const pinned = normalizePinned(rawPinned);
      debugLog("applyPinnedState", pinned);
      if (!player || !isPinnedActive(pinned)) {
        debugLog("inactive or missing pinned state");
        lastAppliedRef.current = null;
        clearPinnedPlayerCache();
        return;
      }

      const isSelf =
        skipSelfPlaylist &&
        idsEqual(currentUser?._id || currentUser?.id, pinned.userId);

      if (!isSelf) {
        const storedEnabled = player.shuffleEnabled;
        lastShufflePreferenceRef.current = {
          enabled: storedEnabled,
          ownerId: pinned.userId,
        };
      }

      const playlist = pinned.playlist;
      const firstTrackUrl = playlist?.length ? playlist[0]?.url || "" : "";
      const signature = [
        pinned.userId,
        pinned.allowShuffle ? "1" : "0",
        pinned.currentIndex ?? "",
        playlist?.length || 0,
        firstTrackUrl,
      ].join("|");

      writePinnedPlayerCache(withPinnedSignature(pinned, signature));

      if (lastAppliedRef.current === signature) {
        debugLog("signature unchanged", signature);
        return;
      } else {
        debugLog("applying signature", signature);
        lastAppliedRef.current = signature;
      }

      // ✅ 構建 playerOwner 對象，確保結構一致
      const playerOwnerObj = {
        userId: pinned.userId,
        username: pinned.username,
      };
      if (typeof pinned.allowShuffle === "boolean") {
        playerOwnerObj.allowShuffle = pinned.allowShuffle;
      }
      
      player.setPlayerOwner?.(playerOwnerObj);
      player.setPinnedOwnerInfo?.({
        userId: pinned.userId,
        allowShuffle: pinned.allowShuffle,
        shuffleEnabled: player.shuffleEnabled,
      });
      debugLog("setPlayerOwner", pinned.userId, pinned.allowShuffle);
      debugLog("setPinnedOwnerInfo from bootstrap", {
        userId: pinned.userId,
        allowShuffle: pinned.allowShuffle,
        shuffleEnabled: player.shuffleEnabled,
      });
      player.setShareMode?.(shareMode);
      player.setMiniPlayerEnabled?.(true);

      if (typeof pinned.allowShuffle === "boolean") {
        player.setShuffleAllowed?.(pinned.allowShuffle);
        if (!pinned.allowShuffle) {
          const snapshot = lastShufflePreferenceRef.current;
          if (snapshot && snapshot.ownerId === pinned.userId) {
            debugLog("allowShuffle false → disable shuffle");
            player.setShuffleEnabled?.(false);
          }
        } else {
          let desiredEnabled = lastShufflePreferenceRef.current?.enabled;
          if (typeof window !== "undefined") {
            try {
              const stored = localStorage.getItem(
                `playlist_${pinned.userId}_shuffle`,
              );
              if (stored === "1") {
                desiredEnabled = true;
              } else if (stored === "0") {
                desiredEnabled = false;
              }
            } catch (error) {
              debugLog("failed to read shuffle preference", error);
            }
          }
          if (typeof desiredEnabled !== "boolean") {
            desiredEnabled = !!player.shuffleEnabled;
          }
          debugLog("allowShuffle true → restore shuffle", {
            desiredEnabled,
            ownerId: pinned.userId,
          });
          player.setShuffleEnabled?.(!!desiredEnabled);
          lastShufflePreferenceRef.current = {
            enabled: !!desiredEnabled,
            ownerId: pinned.userId,
          };
          player.setPinnedOwnerInfo?.({
            userId: pinned.userId,
            allowShuffle: pinned.allowShuffle,
            shuffleEnabled: !!desiredEnabled,
          });
          debugLog("restore shuffle preference", {
            userId: pinned.userId,
            allowShuffle: pinned.allowShuffle,
            desiredEnabled,
          });
        }
      }

      if (isSelf) {
        return;
      }

      player.setPlaylist?.(playlist);

      if (playlist.length === 0) {
        player.setActiveIndex?.(0);
        return;
      }

      const nextIndex = Math.min(
        Math.max(Number(pinned.currentIndex) || 0, 0),
        playlist.length - 1,
      );
      const track = playlist[nextIndex];

      player.setActiveIndex?.(nextIndex);

      if (track?.url) {
        player.setOriginUrl?.(track.url);
        player.setSrc?.(track.url);
        player.setTrackTitle?.(track.title || track.url);
      }
    },
    [player, currentUser?._id, currentUser?.id, shareMode, skipSelfPlaylist],
  );

  useEffect(() => {
    if (!player) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    if (currentUser === null) {
      clearPinnedPlayerCache();
      bootstrapExecutedRef.current = false; // 重置標記
      return;
    }
    
    // ✅ 如果已經執行過 bootstrap，不再重複執行（避免無限循環）
    if (bootstrapExecutedRef.current) {
      return;
    }
    
    try {
      const cached = readPinnedPlayerCache();
      if (!cached) {
        bootstrapExecutedRef.current = true; // 標記為已執行
        return;
      }
      if (!isPinnedActive(cached)) {
        clearPinnedPlayerCache();
        bootstrapExecutedRef.current = true; // 標記為已執行
        return;
      }
      bootstrapExecutedRef.current = true; // 標記為已執行
      applyPinnedState(cached);
    } catch (error) {
      debugLog("failed to bootstrap from cache", error);
      clearPinnedPlayerCache();
      bootstrapExecutedRef.current = false; // 執行失敗時重置，允許重試
    }
  }, [applyPinnedState, player, currentUser?._id]); // ✅ 只依賴關鍵字段，避免 currentUser 對象引用變化

  useEffect(() => {
    if (currentUser === undefined || !player) {
      return;
    }

    const rawPinned =
      currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const normalized = normalizePinned(rawPinned);
    
    // ✅ 生成簽名來檢查是否與上次相同，避免重複執行
    const pinnedSignature = normalized 
      ? `${normalized.userId}-${normalized.expiresAt || ''}-${normalized.allowShuffle || ''}`
      : 'no-pinned';
    
    if (lastPinnedSignatureRef.current === pinnedSignature) {
      return; // 如果與上次相同，不重複執行
    }
    lastPinnedSignatureRef.current = pinnedSignature;

    if (isPinnedActive(normalized)) {
      debugLog("init pinned", normalized?.userId);
      applyPinnedState(normalized);
    } else {
      debugLog("init no pinned state");
      player.setShareMode?.(shareMode);
      // ✅ 如果在用戶頁面，不應該禁用播放器（個人頁面會自己管理播放器啟用狀態）
      // ✅ 只有在非用戶頁面時才禁用播放器
      if (disableOnUnpinned && !isUserPage) {
        resetPlayerWhenUnpinned(player, shareMode);
      }
      lastAppliedRef.current = null;
      lastShufflePreferenceRef.current = null;
      player.setPinnedOwnerInfo?.(null);
    }
  }, [applyPinnedState, currentUser?.pinnedPlayer?.userId, currentUser?.pinnedPlayer?.expiresAt, currentUser?.pinnedPlayer?.allowShuffle, disableOnUnpinned, player, shareMode, isUserPage]); // ✅ 只依賴關鍵字段，避免 currentUser 對象引用變化
}


"use client";

import { useCallback, useEffect, useRef } from "react";

const PINNED_CACHE_KEY = "app_pinned_player_cache";

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
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(PINNED_CACHE_KEY);
    } catch {}
  }
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

  const applyPinnedState = useCallback(
    (rawPinned) => {
      const pinned = normalizePinned(rawPinned);
      debugLog("applyPinnedState", pinned);
      if (!player || !isPinnedActive(pinned)) {
        debugLog("inactive or missing pinned state");
        lastAppliedRef.current = null;
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem(PINNED_CACHE_KEY);
          } catch {}
        }
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

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            PINNED_CACHE_KEY,
            JSON.stringify({ ...pinned, signature }),
          );
        } catch {}
      }

      if (lastAppliedRef.current === signature) {
        debugLog("signature unchanged", signature);
        return;
      } else {
        debugLog("applying signature", signature);
        lastAppliedRef.current = signature;
      }

      player.setPlayerOwner?.({
        userId: pinned.userId,
        username: pinned.username,
        ...(typeof pinned.allowShuffle === "boolean"
          ? { allowShuffle: pinned.allowShuffle }
          : {}),
      });
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
      try {
        sessionStorage.removeItem(PINNED_CACHE_KEY);
      } catch {}
      return;
    }
    try {
      const cachedRaw = sessionStorage.getItem(PINNED_CACHE_KEY);
      if (!cachedRaw) {
        return;
      }
      const parsed = JSON.parse(cachedRaw);
      if (!parsed) {
        return;
      }
      if (!isPinnedActive(parsed)) {
        sessionStorage.removeItem(PINNED_CACHE_KEY);
        return;
      }
      applyPinnedState(parsed);
    } catch (error) {
      debugLog("failed to bootstrap from cache", error);
      try {
        sessionStorage.removeItem(PINNED_CACHE_KEY);
      } catch {}
    }
  }, [applyPinnedState, player, currentUser]);

  useEffect(() => {
    if (currentUser === undefined || !player) {
      return;
    }

    const rawPinned =
      currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const normalized = normalizePinned(rawPinned);

    if (isPinnedActive(normalized)) {
      debugLog("init pinned", normalized?.userId);
      applyPinnedState(normalized);
    } else {
      debugLog("init no pinned state");
      player.setShareMode?.(shareMode);
      if (disableOnUnpinned) {
        resetPlayerWhenUnpinned(player, shareMode);
      }
      lastAppliedRef.current = null;
      lastShufflePreferenceRef.current = null;
      player.setPinnedOwnerInfo?.(null);
    }
  }, [applyPinnedState, currentUser, disableOnUnpinned, player, shareMode]);
}


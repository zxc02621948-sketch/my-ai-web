"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const getTokenFromCookie = () =>
  typeof document === "undefined"
    ? null
    : document.cookie.match(/token=([^;]+)/)?.[1] ?? null;

const getFollowOverrideMap = () => {
  if (typeof window === "undefined") return null;
  if (!window.__followOverrides) {
    window.__followOverrides = new Map();
  }
  return window.__followOverrides;
};

const isSameId = (a, b) => (a && b ? String(a) === String(b) : false);

export function useFollowState({
  ownerId,
  currentUser,
  externalIsFollowing,
  onFollowToggle,
  onLocalUpdate,
}) {
  const followLockRef = useRef(false);

  const overrideMap = getFollowOverrideMap();

  const resolvedFromCurrentUser = useMemo(() => {
    if (!ownerId || !Array.isArray(currentUser?.following)) return undefined;
    const matched = currentUser.following.some((id) => isSameId(id, ownerId));
    return matched;
  }, [currentUser?.following, ownerId]);

  const [authorFollowing, setAuthorFollowing] = useState(() => {
    const override =
      overrideMap?.has(String(ownerId))
        ? overrideMap.get(String(ownerId))
        : undefined;
    if (typeof override === "boolean") return override;
    if (typeof externalIsFollowing === "boolean") return externalIsFollowing;
    if (typeof resolvedFromCurrentUser === "boolean")
      return resolvedFromCurrentUser;
    return false;
  });

  const applyFollowState = useCallback(
    (next) => {
      setAuthorFollowing(next);
      if (overrideMap && ownerId) {
        overrideMap.set(String(ownerId), next);
      }
      onLocalUpdate?.(next);
    },
    [overrideMap, ownerId, onLocalUpdate]
  );

  useEffect(() => {
    const resolved =
      overrideMap?.has(String(ownerId))
        ? overrideMap.get(String(ownerId))
        :
      typeof externalIsFollowing === "boolean"
        ? externalIsFollowing
        : resolvedFromCurrentUser;
    if (typeof resolved === "boolean" && resolved !== authorFollowing) {
      applyFollowState(resolved);
    }
  }, [
    overrideMap,
    ownerId,
    externalIsFollowing,
    resolvedFromCurrentUser,
    authorFollowing,
    applyFollowState,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event) => {
      const { targetUserId, isFollowing: next } = event.detail || {};
      if (!ownerId || !isSameId(targetUserId, ownerId)) return;
      applyFollowState(Boolean(next));
    };
    window.addEventListener("follow-changed", handler);
    return () => window.removeEventListener("follow-changed", handler);
  }, [ownerId, applyFollowState]);

  const handleFollowToggle = useCallback(
    async (providedState) => {
      if (!ownerId) return;
      if (followLockRef.current) return;

      if (!currentUser) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("openLoginModal"));
        }
        return;
      }

      followLockRef.current = true;

      const previous = authorFollowing;
      const nextState =
        typeof providedState === "boolean" ? providedState : !previous;
      applyFollowState(nextState);

      const token = getTokenFromCookie();
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      try {
        if (typeof onFollowToggle === "function") {
          await onFollowToggle(ownerId, nextState);
        } else {
          if (nextState) {
            await axios.post(
              "/api/follow",
              { userIdToFollow: ownerId },
              { headers, withCredentials: true }
            );
          } else {
            await axios.delete("/api/follow", {
              data: { userIdToUnfollow: ownerId },
              headers,
              withCredentials: true,
            });
          }
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("follow-changed", {
              detail: {
                targetUserId: String(ownerId),
                isFollowing: nextState,
              },
            })
          );
        }
      } catch (error) {
        console.error("追蹤切換失敗:", error);
        applyFollowState(previous);
        throw error;
      } finally {
        followLockRef.current = false;
      }
    },
    [ownerId, currentUser, authorFollowing, onFollowToggle, applyFollowState]
  );

  return {
    authorFollowing,
    handleFollowToggle,
  };
}


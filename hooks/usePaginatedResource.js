"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function defaultIdSelector(item) {
  if (!item || typeof item !== "object") return null;
  if (item._id) return String(item._id);
  if (item.id) return String(item.id);
  return null;
}

export default function usePaginatedResource({
  fetchPage,
  deps = [],
  initialPage = 1,
  idSelector = defaultIdSelector,
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const itemsRef = useRef([]);

  const resetState = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setPage(initialPage);
    setHasMore(true);
  }, [initialPage]);

  const mergeItems = useCallback(
    (incoming, append) => {
      if (!append) {
        itemsRef.current = incoming;
        setItems(incoming);
        return;
      }

      const knownIds = new Set(itemsRef.current.map((item) => idSelector(item)));
      const merged = [...itemsRef.current];

      for (const entry of incoming) {
        const id = idSelector(entry);
        if (id && knownIds.has(id)) continue;
        merged.push(entry);
        if (id) knownIds.add(id);
      }

      itemsRef.current = merged;
      setItems(merged);
    },
    [idSelector],
  );

  const setItemsManual = useCallback((updater) => {
    setItems((prev) => {
      const next =
        typeof updater === "function"
          ? updater(Array.isArray(prev) ? prev : [])
          : updater;
      const normalized = Array.isArray(next) ? next : [];
      itemsRef.current = normalized;
      return normalized;
    });
  }, []);

  const load = useCallback(
    async (targetPage, append) => {
      if (!enabled) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const result = await fetchPage(targetPage);
        const incoming = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result)
            ? result
            : [];

        mergeItems(incoming, append);

        const derivedHasMore =
          typeof result?.hasMore === "boolean"
            ? result.hasMore
            : incoming.length > 0;

        setHasMore(derivedHasMore);
        setPage(targetPage);
      } catch (error) {
        console.error("usePaginatedResource load error:", error);
        if (!append) {
          itemsRef.current = [];
          setItems([]);
        }
        setHasMore(false);
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    },
    [enabled, fetchPage, mergeItems],
  );

  const refresh = useCallback(() => {
    resetState();
    if (!enabled) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    load(initialPage, false);
  }, [enabled, initialPage, load, resetState]);

  const depsKey = useMemo(() => {
    if (!Array.isArray(deps) || deps.length === 0) return "__no_deps__";
    return deps.map((token) => String(token ?? "")).join("||");
  }, [deps]);

  useEffect(() => {
    if (!enabled) {
      resetState();
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    refresh();
  }, [enabled, refresh, depsKey, resetState]);

  const loadMore = useCallback(() => {
    if (!enabled || loadingMore || !hasMore || isFetchingRef.current) return;
    load(page + 1, true);
  }, [enabled, hasMore, load, loadingMore, page]);

  return {
    items,
    page,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    refresh,
    setItems: setItemsManual,
  };
}

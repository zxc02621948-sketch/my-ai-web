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
  mergeStrategy, // optional custom merge function
  orderKey,
  orderComparator,
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsRef = useRef([]);
  const appendFetchingRef = useRef(false);
  const fetchIdRef = useRef(0);

  const resetState = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setPage(initialPage);
    setHasMore(true);
  }, [initialPage]);

  const mergeItems = useCallback(
    (incoming, append) => {
      const normalizedIncoming = Array.isArray(incoming) ? incoming : [];

      if (typeof mergeStrategy === "function") {
        const merged = mergeStrategy({
          existing: itemsRef.current,
          incoming: normalizedIncoming,
          append,
        });
        let normalizedMerged = Array.isArray(merged) ? merged : [];
        if (orderComparator && normalizedMerged.length > 1) {
          normalizedMerged = [...normalizedMerged].sort(orderComparator);
        }
        itemsRef.current = normalizedMerged;
        setItems(normalizedMerged);
        return;
      }

      if (!append) {
        itemsRef.current = normalizedIncoming;
        setItems(normalizedIncoming);
        return;
      }

      const knownIds = new Map(
        itemsRef.current.map((item, index) => [idSelector(item), index]),
      );

      const merged = [...itemsRef.current];

      normalizedIncoming.forEach((entry) => {
        const id = idSelector(entry);
        if (id && knownIds.has(id)) {
          // 覆寫既有項目（以新資料為準）
          merged[knownIds.get(id)] = entry;
        } else {
          merged.push(entry);
          if (id) knownIds.set(id, merged.length - 1);
        }
      });

      const nextItems =
        orderComparator && merged.length > 1
          ? [...merged].sort(orderComparator)
          : merged;

      itemsRef.current = nextItems;
      setItems(nextItems);
    },
    [idSelector],
  );

  const setItemsManual = useCallback((updater) => {
    setItems((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      let next =
        typeof updater === "function"
          ? updater(prevArr)
          : updater;
      if (!Array.isArray(next)) {
        next = [];
      }

      if (orderComparator && next.length > 1) {
        next = [...next].sort(orderComparator);
      }

      itemsRef.current = next;
      return next;
    });
  }, []);

  const load = useCallback(
    async (targetPage, append) => {
      if (!enabled) return;
      if (append && appendFetchingRef.current) return;

      const requestId = append ? fetchIdRef.current : ++fetchIdRef.current;
      const requestDepsKey = depsKeyRef.current;

      if (append) {
        appendFetchingRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await fetchPage(targetPage);
        const incoming = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result)
            ? result
            : [];

        const derivedHasMore =
          typeof result?.hasMore === "boolean"
            ? result.hasMore
            : incoming.length > 0;

        const depsStillMatch = requestDepsKey === depsKeyRef.current;
        const isLatestNonAppend =
          append || requestId === fetchIdRef.current;

        if (!depsStillMatch || !isLatestNonAppend) {
          return;
        }

        mergeItems(incoming, append);
        setHasMore(derivedHasMore);
        setPage(targetPage);
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        console.error("usePaginatedResource load error:", error);
        if (!append) {
          itemsRef.current = [];
          setItems([]);
        }
        setHasMore(false);
      } finally {
        if (append) {
          appendFetchingRef.current = false;
          setLoadingMore(false);
        } else if (requestId === fetchIdRef.current) {
          setLoading(false);
        }
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
  const depsKeyRef = useRef(depsKey);
  useEffect(() => {
    depsKeyRef.current = depsKey;
  }, [depsKey]);

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
    if (!enabled || loadingMore || !hasMore || appendFetchingRef.current) return;
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

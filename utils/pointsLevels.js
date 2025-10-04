// utils/pointsLevels.js
// 积分等級規則與工具

export const LEVELS = [
  { key: "lv1", rank: "LV1", title: "啟程者", min: 0, color: "bg-amber-700" },
  { key: "lv2", rank: "LV2", title: "創作者", min: 150, color: "bg-zinc-300" },
  { key: "lv3", rank: "LV3", title: "探索者", min: 500, color: "bg-yellow-400" },
  { key: "lv4", rank: "LV4", title: "星級創作者", min: 1000, color: "bg-blue-400" },
  { key: "lv5", rank: "LV5", title: "創界者", min: 5000, color: "bg-purple-500" },
];

export function getLevelIndex(points = 0) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) idx = i;
  }
  return idx;
}

export function getLevelInfo(points = 0) {
  const index = getLevelIndex(points);
  const level = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  const currentMin = level.min;
  const nextMin = next ? next.min : null;
  const span = (nextMin ?? currentMin) - currentMin || 1;
  const progressed = Math.max(0, points - currentMin);
  const progressPct = next ? Math.max(0, Math.min(100, Math.round((progressed / span) * 100))) : 100;
  const toNext = next ? Math.max(0, nextMin - points) : 0;
  return {
    index,
    key: level.key,
    // 保留 name 作為等級簡稱（LVx）以相容既有呼叫
    name: level.rank,
    rank: level.rank,
    title: level.title,
    display: `${level.rank} ${level.title}`,
    color: level.color,
    min: currentMin,
    nextMin,
    progressPct,
    toNext,
    isMax: !next,
  };
}
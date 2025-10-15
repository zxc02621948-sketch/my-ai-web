// utils/pointsLevels.js
// 积分等級規則與工具

export const LEVELS = [
  { key: "lv1", rank: "LV1", title: "探索者", min: 0, color: "bg-gray-500" },
  { key: "lv2", rank: "LV2", title: "創作者", min: 150, color: "bg-green-500" },
  { key: "lv3", rank: "LV3", title: "共鳴者", min: 500, color: "bg-blue-500" },
  { key: "lv4", rank: "LV4", title: "塑界者", min: 1000, color: "bg-cyan-500" },
  { key: "lv5", rank: "LV5", title: "筑夢者", min: 2000, color: "bg-indigo-500" },
  { key: "lv6", rank: "LV6", title: "界行者", min: 3500, color: "bg-purple-500" },
  { key: "lv7", rank: "LV7", title: "星紋者", min: 5000, color: "bg-pink-500" },
  { key: "lv8", rank: "LV8", title: "融界者", min: 7000, color: "bg-yellow-500" },
  { key: "lv9", rank: "LV9", title: "光域者", min: 9000, color: "bg-orange-500" },
  { key: "lv10", rank: "LV10", title: "無界者", min: 10000, color: "bg-red-600" },
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
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ALLOWED_LAYER_ORDERS = new Set(["frame-on-top", "frame-behind"]);

export function sanitizeHexColor(input, fallback = "#3B82F6") {
  const value = String(input || "").trim();
  if (!HEX_COLOR_RE.test(value)) return fallback;
  return value;
}

export function sanitizeFrameSize(input, fallback = 100) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120, Math.max(80, Math.round(n)));
}

export function sanitizeOpacity(input, fallback = 1) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function sanitizeLayerOrder(input, fallback = "frame-on-top") {
  const value = String(input || "").trim();
  return ALLOWED_LAYER_ORDERS.has(value) ? value : fallback;
}

export function sanitizeFrameSettings(input = {}) {
  return {
    color: sanitizeHexColor(input.color, "#ffffff"),
    opacity: sanitizeOpacity(input.opacity, 1),
    frameOpacity: sanitizeOpacity(input.frameOpacity, 1),
    layerOrder: sanitizeLayerOrder(input.layerOrder, "frame-on-top"),
  };
}

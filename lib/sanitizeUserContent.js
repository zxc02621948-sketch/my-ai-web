// Server-side content sanitization for user-generated text.
// Goal: reduce stored XSS payloads while preserving normal markdown text.

function normalizeLineBreaks(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripDangerousBlocks(text) {
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, "")
    .replace(/<math[\s\S]*?>[\s\S]*?<\/math>/gi, "");
}

function stripInlineHandlers(text) {
  return text
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function sanitizeProtocols(text) {
  // Markdown links: [label](javascript:...)
  let out = text.replace(/\]\(\s*(javascript:|vbscript:|data:text\/html)[^)]+\)/gi, "](#)");
  // HTML attrs that may remain
  out = out.replace(
    /(href|src)\s*=\s*("|\')\s*(javascript:|vbscript:|data:text\/html)[\s\S]*?\2/gi,
    '$1="#"'
  );
  return out;
}

function collapseNoise(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function sanitizeTitle(input) {
  const text = normalizeLineBreaks(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 200);
}

export function sanitizePostContent(input) {
  let text = normalizeLineBreaks(input);
  text = stripDangerousBlocks(text);
  text = stripInlineHandlers(text);
  text = sanitizeProtocols(text);
  text = collapseNoise(text);
  return text.slice(0, 50000);
}


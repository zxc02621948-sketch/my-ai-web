// /utils/notifTemplates.js
// 超輕量模板渲染（避免額外相依）。支援 {{var}} 與 {{#if var}}...{{/if}}（簡單版）
function renderTmpl(tmpl, ctx = {}) {
  const withIf = tmpl.replace(/{{#if\s+([\w.]+)}}([\s\S]*?){{\/if}}/g, (_, key, inner) => {
    const v = key.split('.').reduce((o,k)=>o?.[k], ctx);
    return v ? inner : "";
  });
  return withIf.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const v = key.split('.').reduce((o,k)=>o?.[k], ctx);
    return (v ?? "").toString();
  });
}

// 小工具：讓 ctx 同時相容「舊欄位（imageTitle / imageUuid / username）」與「新欄位（user/image 巢狀）」
function normalizeCtx(ctx = {}) {
  const user = ctx.user || { username: ctx.username || "" };
  const image = ctx.image || {
    title: ctx.imageTitle || "",
    _id: ctx.imageId || ctx.image_id || ctx.image?._id || "",
    imageId: ctx.imageUuid || ctx.image_uuid || ctx.image?.imageId || ""
  };
  return { ...ctx, user, image };
}

export const TEMPLATES = {
  // --- 你原本就有的 ---
  // 改分級（例如 18+ → 15+ → 一般）
  "recat.nsfw_to_sfw": {
    title: "您的作品分級已調整",
    body: [
      "您好 {{user.username}}，",
      "",
      "我們在審查「{{image.title}}」（ID: {{image._id}}）時發現分級與內容不符，已將分級由 {{oldRating}} 調整為 {{newRating}}。",
      "原因：{{reason}}（代碼：{{reasonCode}}）",
      "",
      "注意：若再次發生，可能導致帳號警告或限制曝光。",
      "{{#if appealUrl}}若您認為有誤，您可以提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  // 下架（違規放到錯誤分級、侵權等）
  "takedown.nsfw_in_sfw": {
    title: "作品因違規已下架",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因為「{{reason}}」（代碼：{{reasonCode}}）已被下架。",
      "違規說明：不得將 18+ 內容上傳到 15+ 或一般分區。",
      "當前警告等級：{{warning.level}}／累計：{{warning.count}} 次。",
      "",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  // 警告（等級版模）
  "warn.level1": {
    title: "帳號警告（Level 1）",
    body: [
      "您好 {{user.username}}，",
      "我們針對您近期的行為發出 Level 1 警告。",
      "理由：{{reason}}（代碼：{{reasonCode}}）",
      "後續若再發生，將升級為 Level 2，可能影響曝光與上傳權限。",
    ].join("\n"),
  },
  "warn.level2": {
    title: "帳號警告（Level 2）",
    body: [
      "您好 {{user.username}}，",
      "這是 Level 2 警告。若再違規，可能暫時停權或限制上傳。",
      "理由：{{reason}}（代碼：{{reasonCode}}）",
    ].join("\n"),
  },
  "warn.level3": {
    title: "帳號警告（Level 3）",
    body: [
      "您好 {{user.username}}，",
      "這是 Level 3 警告。您的部分功能已受限制。",
      "理由：{{reason}}（代碼：{{reasonCode}}）",
    ].join("\n"),
  },

  // 新增到 TEMPLATES 內：

  "takedown.duplicate_spam": {
    title: "作品因重複/洗版已移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因被檢舉並確認為「重複上傳或洗版」而被移除或合併處理。",
      "{{#if reason}}補充說明：{{reason}}{{/if}}",
      "",
      "請避免短時間大量張貼相同或高度相似內容，影響他人瀏覽體驗。",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}"
    ].join("\n"),
  },

  "takedown.broken_image": {
    title: "作品因檔案異常/無法顯示已移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因檔案毀損或無法正常顯示而被移除。",
      "{{#if reason}}技術訊息：{{reason}}{{/if}}",
      "",
      "建議您重新上傳有效的圖片檔；若是外連圖導致阻擋，請改為直接上傳。",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}"
    ].join("\n"),
  },

  "takedown.other_with_note": {
    title: "作品因其他原因已移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因其他原因被移除。",
      "{{#if reason}}處理說明：{{reason}}{{/if}}",
      "",
      "若需要進一步協助，請回覆本訊息與管理員聯繫。",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}"
    ].join("\n"),
  },

  // --- 新增：配合刪圖 API 的三個 actionKey ---
  "takedown.category_wrong": {
    title: "作品因分類錯誤已調整/移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）經檢舉與審核，判定為「分類錯誤」。本站已進行調整或移除處理。",
      "{{#if reason}}理由：{{reason}}{{/if}}",
      "",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  "takedown.rating_wrong": {
    title: "作品因分級錯誤已調整/移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因為「分級錯誤（例如 18+ 放在 15+／一般）」已被調整或移除。",
      "{{#if reason}}理由：{{reason}}{{/if}}",
      "",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  "takedown.policy_violation": {
    title: "作品違反平台規範，已移除",
    body: [
      "您好 {{user.username}}，",
      "",
      "您上傳的「{{image.title}}」（ID: {{image._id}}）因違反平台規範已被移除。",
      "{{#if reason}}理由：{{reason}}{{/if}}",
      "",
      "{{#if appealUrl}}若您對判定有疑義，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  // --- 新增：更改分類 ---
  "recat.category_fixed": {
    title: "您的作品分類已調整",
    body: [
      "您好 {{user.username}}，",
      "",
      "我們在審查「{{image.title}}」（ID: {{image._id}}）時發現分類與內容不符，已將分類由「{{oldCategory}}」調整為「{{newCategory}}」。",
      "{{#if reason}}原因：{{reason}}{{/if}}",
      "",
      "注意：請確保未來上傳時選擇正確的分類，避免影響曝光或造成用戶困擾。",
      "{{#if appealUrl}}若您認為有誤，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  // --- 更新：更改分級模板（原本就有 recat.nsfw_to_sfw，現在統一使用 rerate.fix_label） ---
  "rerate.fix_label": {
    title: "您的作品分級已調整",
    body: [
      "您好 {{user.username}}，",
      "",
      "我們在審查「{{image.title}}」（ID: {{image._id}}）時發現分級與內容不符，已將分級由「{{oldRating}}」調整為「{{newRating}}」。",
      "{{#if reason}}原因：{{reason}}{{/if}}",
      "",
      "注意：若再次發生，可能導致帳號警告或限制曝光。請確保未來上傳時選擇正確的分級。",
      "{{#if appealUrl}}若您認為有誤，可於 7 天內提出申訴：{{appealUrl}}{{/if}}",
    ].join("\n"),
  },

  // --- 新增：檢舉處理結果通知 ---
  "report.rejected": {
    title: "檢舉處理結果通知",
    body: [
      "您好，",
      "",
      "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉經審核後不成立。",
      "{{#if note}}管理員備註：{{note}}{{/if}}",
      "",
      "感謝您協助維護社群品質。若未來發現違規內容，歡迎繼續回報。",
    ].join("\n"),
  },

  "report.action_taken": {
    title: "檢舉處理結果通知",
    body: [
      "您好，",
      "",
      "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉已處理完成。",
      "{{#if action}}處理結果：{{action}}{{/if}}",
      "{{#if note}}管理員備註：{{note}}{{/if}}",
      "",
      "感謝您協助維護社群品質！",
    ].join("\n"),
  },

  "report.closed": {
    title: "檢舉已結案",
    body: [
      "您好，",
      "",
      "您針對圖片「{{image.title}}」（ID: {{image._id}}）的檢舉已結案。",
      "{{#if note}}備註：{{note}}{{/if}}",
      "",
      "感謝您的回報。",
    ].join("\n"),
  },
};

// 放在檔案底部，覆蓋原本的 renderTemplate
const TEMPLATE_ALIAS = {
  // 重複 / 洗版
  "takedown.duplicate": "takedown.duplicate_spam",
  "takedown.spam": "takedown.duplicate_spam",

  // 壞圖 / 無法顯示
  "takedown.broken": "takedown.broken_image",
  "takedown.cannot_display": "takedown.broken_image",

  // 其他（需說明）
  "takedown.other": "takedown.other_with_note",

  // 分類/分級錯誤
  "takedown.category": "takedown.category_wrong",
  "takedown.rating": "takedown.rating_wrong",
};

export function renderTemplate(key, ctxInput) {
  const key2 = TEMPLATE_ALIAS[key] || key;
  const t = TEMPLATES[key2];
  if (!t) throw new Error(`Template not found: ${key}`);
  const ctx = normalizeCtx(ctxInput);
  const title = renderTmpl(t.title, ctx);
  const body  = renderTmpl(t.body, ctx);
  return { title, subject: title, body };
}


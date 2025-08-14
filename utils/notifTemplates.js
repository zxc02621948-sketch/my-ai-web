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

export const TEMPLATES = {
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
};

export function renderTemplate(key, ctx) {
  const t = TEMPLATES[key];
  if (!t) throw new Error(`Template not found: ${key}`);
  return {
    title: renderTmpl(t.title, ctx),
    body: renderTmpl(t.body, ctx),
  };
}

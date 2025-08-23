// lib/civitai.js
export async function civitaiByHash(hash, token = process.env.CIVITAI_API_TOKEN) {
  if (!hash) return null;
  const url = `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(hash)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Civitai lookup failed ${res.status}`);
  const data = await res.json();

  const versionId = data.id ?? data.modelVersionId ?? data?.modelVersion?.id ?? null;
  const modelId   = data.modelId ?? data?.model?.id ?? null;
  const modelName = data?.model?.name || data?.name || '';
  const modelType = (data?.model?.type || '').toUpperCase(); // 'CHECKPOINT' / 'LORA' / 'EMBEDDING' 等

  // 兩種可用連結：版本頁 or 模型頁帶版本參數
  const versionLink = versionId ? `https://civitai.com/model-versions/${versionId}` : null; // 社群證實可直接訪問版本頁 :contentReference[oaicite:1]{index=1}
  const modelLink   = modelId
    ? (versionId
        ? `https://civitai.com/models/${modelId}?modelVersionId=${versionId}`
        : `https://civitai.com/models/${modelId}`)
    : versionLink;

  return {
    hash,
    modelId,
    versionId,
    modelName,
    modelType, // e.g. 'LORA', 'CHECKPOINT'
    links: { modelLink, versionLink },
  };
}

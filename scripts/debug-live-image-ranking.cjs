const fs = require("fs");
const { MongoClient } = require("mongodb");

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const txt = fs.readFileSync(path, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function toMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function calcLive(doc, now, cfg) {
  const clicks = Number(doc.clicks || 0);
  const likesCount = Array.isArray(doc.likes) ? doc.likes.length : Number(doc.likesCount || 0);
  const commentsCount = Number(doc.commentsCount || 0);
  const completenessScore = Number(doc.completenessScore || 0);
  const initialBoost = Number(doc.initialBoost || 0);

  let startMs = toMs(doc.createdAt) || now;
  const powerUsedAtMs = toMs(doc.powerUsedAt);
  const powerExpiryMs = toMs(doc.powerExpiry);
  const powerValid = doc.powerUsed === true && powerUsedAtMs && powerExpiryMs && now < powerExpiryMs;
  if (powerValid) startMs = powerUsedAtMs;

  const elapsedHours = Math.max(0, (now - startMs) / 36e5);
  const boostFactor = elapsedHours >= cfg.windowHours ? 0 : Math.max(0, 1 - elapsedHours / cfg.windowHours);
  const decayedBoost = Math.round(initialBoost * boostFactor * 10) / 10;

  const base =
    clicks * cfg.wClick +
    likesCount * cfg.wLike +
    commentsCount * cfg.wComment +
    completenessScore * cfg.wComplete;

  return {
    clicks,
    likesCount,
    commentsCount,
    completenessScore,
    initialBoost,
    elapsedHours: Number(elapsedHours.toFixed(2)),
    decayedBoost,
    base: Number(base.toFixed(2)),
    live: Number((base + decayedBoost).toFixed(2)),
    popScoreDb: Number(doc.popScore || 0),
    powerValid,
  };
}

async function main() {
  loadEnv(".env.local");
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!uri) throw new Error("Missing MONGODB_URI / MONGODB_URL");

  const cfg = {
    wClick: Number(process.env.POP_W_CLICK || 1),
    wLike: Number(process.env.POP_W_LIKE || 8),
    wComment: Number(process.env.POP_W_COMMENT || 2),
    wComplete: Number(process.env.POP_W_COMPLETE || 0.25),
    windowHours: Number(process.env.POP_NEW_WINDOW_HOURS || 10),
  };

  const now = Date.now();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection("images");

  const docs = await col
    .find(
      {},
      {
        projection: {
          title: 1,
          createdAt: 1,
          clicks: 1,
          likes: 1,
          likesCount: 1,
          commentsCount: 1,
          completenessScore: 1,
          initialBoost: 1,
          powerUsed: 1,
          powerUsedAt: 1,
          powerExpiry: 1,
          popScore: 1,
        },
      }
    )
    .toArray();

  const ranked = docs
    .map((d) => ({
      _id: String(d._id),
      title: d.title || "(untitled)",
      ...calcLive(d, now, cfg),
    }))
    .sort((a, b) => b.live - a.live)
    .slice(0, 20);

  console.log(JSON.stringify({ cfg, top: ranked }, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


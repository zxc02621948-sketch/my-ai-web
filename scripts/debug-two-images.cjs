const fs = require("fs");
const { MongoClient, ObjectId } = require("mongodb");

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const txt = fs.readFileSync(path, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function main() {
  loadEnv(".env.local");
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection("images");
  const ids = ["689566a4bab20368aec430c6", "689572ef08fd2f62d0f9ff10"];
  const docs = await col
    .find(
      { _id: { $in: ids.map((x) => new ObjectId(x)) } },
      {
        projection: {
          title: 1,
          rating: 1,
          category: 1,
          categories: 1,
          hasMetadata: 1,
          isPublic: 1,
          createdAt: 1,
          clicks: 1,
          likes: 1,
          likesCount: 1,
          commentsCount: 1,
          completenessScore: 1,
          popScore: 1,
        },
      }
    )
    .toArray();
  console.log(JSON.stringify(docs, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


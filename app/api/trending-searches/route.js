import { searchLogMap } from "../log-search/shared";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") || "all";

  const result = [];

  for (const [key, count] of searchLogMap.entries()) {
    const [lvl, keyword] = key.split(":");
    if (lvl === level) {
      result.push({ keyword, count });
    }
  }

  result.sort((a, b) => b.count - a.count);

  return Response.json({
    success: true,
    keywords: result.slice(0, 10),
  });
}

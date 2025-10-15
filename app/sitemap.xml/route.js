// app/sitemap.xml/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import User from "@/models/User";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function GET() {
  try {
    await dbConnect();

    // 靜態頁面
    const staticPages = [
      { url: "", priority: "1.0", changefreq: "daily" }, // 首頁
      { url: "/discussion", priority: "0.9", changefreq: "daily" },
      { url: "/models", priority: "0.8", changefreq: "weekly" },
      { url: "/levels", priority: "0.7", changefreq: "monthly" },
      { url: "/qa", priority: "0.8", changefreq: "monthly" },
      { url: "/install-guide", priority: "0.7", changefreq: "monthly" },
      { url: "/terms", priority: "0.5", changefreq: "monthly" },
      { url: "/privacy", priority: "0.5", changefreq: "monthly" },
      { url: "/changelog", priority: "0.6", changefreq: "weekly" },
    ];

    // 獲取最新的公開圖片（限制數量避免 sitemap 過大）
    const recentImages = await Image.find({ rating: { $ne: "18+" } })
      .select("_id updatedAt")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    // 獲取活躍用戶的個人頁面
    const activeUsers = await User.find({ isVerified: true, isSuspended: false })
      .select("_id updatedAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // 獲取討論貼文（假設你有討論模型）
    // 如果沒有可以註釋掉
    let discussionPosts = [];
    try {
      const DiscussionPost = (await import("@/models/Comment")).default;
      discussionPosts = await DiscussionPost.find({ isDiscussionPost: true })
        .select("_id updatedAt")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
    } catch (e) {
      // 如果沒有討論模型，忽略錯誤
    }

    // 生成 XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
${recentImages
  .map(
    (img) => `  <url>
    <loc>${BASE_URL}/?image=${img._id}</loc>
    <lastmod>${new Date(img.updatedAt || img.createdAt || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join("\n")}
${activeUsers
  .map(
    (user) => `  <url>
    <loc>${BASE_URL}/user/${user._id}</loc>
    <lastmod>${new Date(user.updatedAt || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
  )
  .join("\n")}
${discussionPosts
  .map(
    (post) => `  <url>
    <loc>${BASE_URL}/discussion/${post._id}</loc>
    <lastmod>${new Date(post.updatedAt || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("❌ Sitemap generation error:", error);
    
    // 返回最小化的 sitemap 避免錯誤
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallbackSitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}


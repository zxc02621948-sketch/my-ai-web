// app/user/[id]/layout.js
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

// ✅ 禁用缓存，確保每次請求都重新生成 metadata
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function generateMetadata({ params }) {
  // ✅ Next.js 15 要求 params 必須先 await
  const { id } = await params;
  
  try {
    await dbConnect();
    const user = await User.findById(id)
      .select("username privacyPreferences")
      .lean();

    if (!user) {
      return {
        title: "用戶不存在",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    // ✅ 檢查隱私設定：如果用戶關閉了個人頁面索引，則設置 noindex
    // 使用 .lean() 後，privacyPreferences 應該是普通對象
    const privacyPrefs = user.privacyPreferences;
    const allowProfileIndexing = privacyPrefs?.allowProfileIndexing;
    
    // 如果明確設置為 false，則不允許索引；否則允許（默認值為 true）
    const allowIndexing = allowProfileIndexing !== false;
    
    return {
      title: `${user.username} 的個人頁面`,
      description: `查看 ${user.username} 在 AI 創界的創作作品`,
      robots: {
        index: allowIndexing,
        follow: allowIndexing,
        googleBot: {
          index: allowIndexing,
          follow: allowIndexing,
        },
      },
    };
  } catch (error) {
    console.error("生成個人頁面 metadata 錯誤:", error);
    return {
      title: "用戶頁面",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default function UserLayout({ children }) {
  return children;
}


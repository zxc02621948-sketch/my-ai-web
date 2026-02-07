import { NextResponse } from "next/server";

/**
 * 當搜尋引擎嘗試爬取 Schema.org SearchAction 的 urlTemplate 佔位符 URL 時，
 * 將其導向首頁，避免被歸類為「頁面會重新導向」的未索引項目。
 * @see https://developers.google.com/search/docs/advanced/structured-data/sitelinks-searchbox
 */
export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // 僅處理首頁
  if (pathname !== "/" && pathname !== "") return NextResponse.next();

  const search = searchParams.get("search");
  if (!search) return NextResponse.next();

  // 當 search 參數為 Schema.org 的佔位符（原始或編碼形式）時，導向乾淨的首頁
  const isPlaceholder =
    search === "{search_term_string}" || search === "%7Bsearch_term_string%7D";

  if (isPlaceholder) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

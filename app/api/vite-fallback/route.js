// 處理 IDE webview 中的 vite 客戶端請求
// 返回空響應以避免 404 錯誤

export async function GET() {
  return new Response('', {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript',
    },
  });
}

export async function POST() {
  return new Response('', {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript',
    },
  });
}
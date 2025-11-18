import { NextResponse } from "next/server";

// ✅ 測試端點：檢查 Cloudflare 環境變數並測試 API 連接
// 注意：這個端點應該只在開發環境或受保護的環境中使用
export async function GET(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

    // ✅ 檢查環境變數是否存在
    const hasAccountId = !!accountId;
    const hasToken = !!token;

    // ✅ 檢查格式（不顯示實際值，只顯示狀態）
    const accountIdValid = hasAccountId && /^[a-f0-9]{32}$/i.test(accountId);
    const tokenValid = hasToken && token.length > 0;

    // ✅ 計算長度（用於驗證）
    const accountIdLength = accountId ? accountId.length : 0;
    const tokenLength = token ? token.length : 0;

    const envStatus = {
      nodeEnv: process.env.NODE_ENV,
      hasAccountId,
      hasToken,
      accountIdValid,
      tokenValid,
      accountIdLength,
      tokenLength,
      // ✅ 只顯示前綴，不顯示完整值（安全考慮）
      accountIdPrefix: accountId ? `${accountId.substring(0, 8)}...` : "未設置",
      tokenPrefix: token ? `${token.substring(0, 10)}...` : "未設置",
    };

    // ✅ 如果環境變數都正確，測試 API 連接（使用與 upload-avatar 相同的方式）
    let apiTest = null;
    if (accountIdValid && tokenValid) {
      try {
        // ✅ 創建一個最小的測試文件來測試 API
        // 使用 1x1 像素的 PNG 圖片（base64）
        const testImageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const testBuffer = Buffer.from(testImageData, 'base64');
        
        // ✅ 在 Node.js 中創建 File 對象（Node.js 18+ 支持）
        const testFile = new File([testBuffer], "test.png", { type: 'image/png' });
        
        // ✅ 使用與 upload-avatar 相同的方式測試
        const testForm = new FormData();
        testForm.append("file", testFile);
        
        const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
        const testRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: testForm,
        });
        
        const testResult = await testRes.json();
        const httpStatus = testRes.status;
        
        apiTest = {
          httpStatus,
          success: testResult.success,
          authenticated: httpStatus === 200 || httpStatus === 401 || httpStatus === 403,
          hasImageId: !!testResult.result?.id,
          error: testResult.errors?.[0]?.message || null,
          errors: testResult.errors,
          // ✅ 如果上傳成功，刪除測試圖片
          ...(testResult.result?.id && {
            testImageId: testResult.result.id,
            note: "測試圖片已上傳"
          })
        };
        
        // ✅ 如果測試成功，嘗試刪除測試圖片
        if (testResult.result?.id) {
          try {
            const deleteRes = await fetch(`${uploadUrl}/${testResult.result.id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (deleteRes.ok) {
              apiTest.testImageCleaned = true;
            }
          } catch (e) {
            // 忽略刪除錯誤
          }
        }
      } catch (apiError) {
        apiTest = {
          error: apiError.message,
          stack: process.env.NODE_ENV === "development" ? apiError.stack : undefined,
          message: "❌ API 測試失敗"
        };
      }
    }

    return NextResponse.json({
      success: true,
      environment: envStatus,
      apiTest,
      message: accountIdValid && tokenValid 
        ? (apiTest?.success 
            ? "✅ 環境變數設置正確，API 連接正常，上傳功能應該可以正常使用"
            : apiTest?.httpStatus === 401 || apiTest?.httpStatus === 403
            ? "❌ API 認證失敗：Token 無效或沒有 Cloudflare Images 權限。請檢查部署環境的 Token 是否與本地一致，並確認 Token 有 Cloudflare Images 的 Edit 權限。"
            : "⚠️ 環境變數設置正確，但 API 測試失敗。請檢查部署日誌獲取詳細錯誤信息。")
        : "❌ 環境變數設置有問題，請檢查部署平台的環境變數設置"
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}


export async function uploadToCloudflare(file) {
  try {
    // 檢查是否在服務器端執行
    const isServer = typeof window === 'undefined';
    
    if (isServer) {
      // 服務器端：直接使用 Cloudflare API
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
      const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

      if (!accountId || !apiToken) {
        return {
          success: false,
          error: "環境變數未設定：CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 未設置"
        };
      }

      // ✅ 驗證 Account ID 格式
      if (!/^[a-f0-9]{32}$/i.test(accountId)) {
        return {
          success: false,
          error: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）"
        };
      }

      // ✅ 確保 token 沒有多餘的空格或換行
      const cleanToken = apiToken.replace(/\s+/g, '');

      const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
        },
        body: formData,
      });

      const result = await uploadRes.json();

      if (!uploadRes.ok || !result.success) {
        console.error("❌ [服務器] Cloudflare 上傳失敗：", result);
        return {
          success: false,
          error: "上傳失敗：" + JSON.stringify(result)
        };
      }

      const imageId = result.result.id;
      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

      return {
        success: true,
        url: imageUrl,
        imageId: imageId,
        width: result.result.width,
        height: result.result.height
      };
    } else {
      // 客戶端：使用內部 API
      const formData = new FormData();
      formData.append("file", file);


      const uploadRes = await fetch("/api/cloudflare-upload", {
        method: "POST",
        body: formData,
      });

      const result = await uploadRes.json();

      if (!uploadRes.ok || !result.success) {
        console.error("❌ [客戶端] Cloudflare 上傳失敗：", result);
        return {
          success: false,
          error: "上傳失敗：" + JSON.stringify(result)
        };
      }

      const imageId = result.imageId;
      const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

      return {
        success: true,
        url: imageUrl,
        imageId: imageId,
        width: null,
        height: null
      };
    }
  } catch (err) {
    console.error("❌ Cloudflare 上傳錯誤：", err);
    return {
      success: false,
      error: err.message || "上傳失敗"
    };
  }
}

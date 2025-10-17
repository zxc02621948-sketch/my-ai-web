export async function uploadToCloudflare(file) {
  try {
    // 檢查是否在服務器端執行
    const isServer = typeof window === 'undefined';
    
    if (isServer) {
      // 服務器端：直接使用 Cloudflare API
      const CLOUDFLARE_UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/5c6250a0576aa4ca0bb9cdf32be0bee1/images/v1`;
      const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "NKLeyPVUMWLGI4MTFmPNnDZj0ZgWA5xj0tS2bQEA";

      const formData = new FormData();
      formData.append("file", file);


      const uploadRes = await fetch(CLOUDFLARE_UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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

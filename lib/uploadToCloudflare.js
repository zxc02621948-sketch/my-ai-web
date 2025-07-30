export async function uploadToCloudflare(file) {
  try {
    const res = await fetch("/api/cloudflare-upload-url", {
      method: "POST",
    });

    if (!res.ok) throw new Error("無法取得上傳網址");

    const { uploadURL } = await res.json();

    const formData = new FormData();
    formData.append("file", file); // ✅ 必須是 File，且 name 為 "file"

    console.log("🧪 即將上傳的檔案：", file);
    console.log("➡️ Content-Type:", file.type);

    for (let [key, val] of formData.entries()) {
      console.log(`🔸 ${key}:`, val, "type:", val.type);
    }

    const uploadRes = await fetch(uploadURL, {
      method: "POST",
      body: formData,
      // ❌ 不要自己加 headers，尤其不能加 Content-Type
      // browser 會自動幫 FormData 加正確的 multipart/form-data
    });

    const result = await uploadRes.json();

    if (!uploadRes.ok || !result.success) {
      console.error("❌ Cloudflare 上傳失敗內容：", result);
      throw new Error("上傳失敗：" + JSON.stringify(result));
    }

    return result.result.id;
  } catch (err) {
    console.error("❌ Cloudflare 上傳錯誤：", err);
    throw err;
  }
}

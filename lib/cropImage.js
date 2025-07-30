export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

// 🧠 傳入裁切區與 mime 類型（預設轉 JPEG）
export async function getCroppedImg(imageSrc, pixelCrop, type = "image/jpeg") {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("裁切失敗，blob 為空"));
          return;
        } 
        
        // ✅ 這裡強制建立正確的 File，並手動傳入 MIME
        const correctedType = type || "image/jpeg";
        const extension = correctedType === "image/png" ? "png" : "jpg";
        const file = new File([blob], `avatar.${extension}`, { type: correctedType });
   
        resolve(file);
      },  
      type,
      0.95 // ✅ 可選：指定 JPEG 品質
    );
  });
}

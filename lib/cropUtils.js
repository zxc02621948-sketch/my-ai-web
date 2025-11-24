// 手動計算裁剪區域的工具函數（基於 react-easy-crop 的邏輯）

/**
 * 限制值在 0 和 max 之間
 */
function limitArea(max, value) {
  return Math.min(max, Math.max(0, value));
}

/**
 * 計算裁剪框尺寸（基於媒體尺寸、容器尺寸和寬高比）
 */
function getCropSize(mediaWidth, mediaHeight, containerWidth, containerHeight, aspect, rotation = 0) {
  // 簡化版本：不考慮旋轉
  const fittingWidth = Math.min(mediaWidth, containerWidth);
  const fittingHeight = Math.min(mediaHeight, containerHeight);

  if (fittingWidth > fittingHeight * aspect) {
    return {
      width: fittingHeight * aspect,
      height: fittingHeight,
    };
  }

  return {
    width: fittingWidth,
    height: fittingWidth / aspect,
  };
}

/**
 * 計算媒體的縮放（適應容器）
 * mediaSize 應該包含 width, height, naturalWidth, naturalHeight
 * width/height 是顯示尺寸（在容器中適應後的尺寸）
 * naturalWidth/naturalHeight 是原始圖片尺寸
 */
function getMediaZoom(mediaSize) {
  // 取像素更多的軸以提高精度
  // 這個值表示：顯示尺寸 / 原始尺寸
  // 如果圖片被縮小適應容器，這個值會 < 1
  return mediaSize.width > mediaSize.height 
    ? mediaSize.width / mediaSize.naturalWidth 
    : mediaSize.height / mediaSize.naturalHeight;
}

/**
 * 計算裁剪區域的像素座標（基於 react-easy-crop 的 computeCroppedArea 邏輯）
 * @param {Object} crop - 裁剪位置 { x, y }
 * @param {Object} mediaSize - 圖片尺寸 { width, height, naturalWidth, naturalHeight }
 * @param {Object} containerSize - 容器尺寸 { width, height }
 * @param {number} aspect - 寬高比 (1 = 正方形)
 * @param {number} zoom - 縮放值
 * @param {number} rotation - 旋轉角度（默認 0）
 * @returns {Object} { x, y, width, height }
 */
export function computeCroppedAreaPixels(crop, mediaSize, containerSize, aspect, zoom, rotation = 0) {
  // 計算裁剪框尺寸
  const cropSize = getCropSize(
    mediaSize.width,
    mediaSize.height,
    containerSize.width,
    containerSize.height,
    aspect,
    rotation
  );
  
  // 計算媒體適應容器的縮放
  const mediaZoom = getMediaZoom(mediaSize);
  
  // 計算媒體的邊界框尺寸（考慮旋轉，這裡簡化為不旋轉）
  const mediaBBoxSize = { width: mediaSize.width, height: mediaSize.height };
  const mediaNaturalBBoxSize = { width: mediaSize.naturalWidth, height: mediaSize.naturalHeight };
  
  // 計算裁剪區域的百分比（在旋轉空間中）
  const croppedAreaPercentages = {
    x: limitArea(100, ((mediaBBoxSize.width - cropSize.width / zoom) / 2 - crop.x / zoom) / mediaBBoxSize.width * 100),
    y: limitArea(100, ((mediaBBoxSize.height - cropSize.height / zoom) / 2 - crop.y / zoom) / mediaBBoxSize.height * 100),
    width: limitArea(100, cropSize.width / mediaBBoxSize.width * 100 / zoom),
    height: limitArea(100, cropSize.height / mediaBBoxSize.height * 100 / zoom)
  };
  
  // 計算像素尺寸
  let widthInPixels = Math.round(limitArea(mediaNaturalBBoxSize.width, croppedAreaPercentages.width * mediaNaturalBBoxSize.width / 100));
  let heightInPixels = Math.round(limitArea(mediaNaturalBBoxSize.height, croppedAreaPercentages.height * mediaNaturalBBoxSize.height / 100));
  
  // 確保寬高比精確匹配（避免捨入誤差）
  const isImgWiderThanHigh = mediaNaturalBBoxSize.width >= mediaNaturalBBoxSize.height * aspect;
  const sizePixels = isImgWiderThanHigh ? {
    width: Math.round(heightInPixels * aspect),
    height: heightInPixels
  } : {
    width: widthInPixels,
    height: Math.round(widthInPixels / aspect)
  };
  
  // 計算裁剪區域的像素座標
  const croppedAreaPixels = {
    ...sizePixels,
    x: Math.round(limitArea(mediaNaturalBBoxSize.width - sizePixels.width, croppedAreaPercentages.x * mediaNaturalBBoxSize.width / 100)),
    y: Math.round(limitArea(mediaNaturalBBoxSize.height - sizePixels.height, croppedAreaPercentages.y * mediaNaturalBBoxSize.height / 100))
  };
  
  return croppedAreaPixels;
}


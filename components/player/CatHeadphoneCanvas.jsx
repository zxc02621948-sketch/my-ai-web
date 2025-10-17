'use client';

import { useEffect, useRef } from 'react';

export default function CatHeadphoneCanvas({ isPlaying, size = 130, colorSettings = {} }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const imageRef = useRef(null);
  const maskImageRef = useRef(null); // 用於存儲遮罩圖片
  const frameRef = useRef(0);
  
  // 預設顏色設定
  const settings = {
    mode: colorSettings.mode || 'rgb',
    speed: colorSettings.speed || 0.02,
    saturation: colorSettings.saturation || 50,
    lightness: colorSettings.lightness || 60,
    hue: colorSettings.hue || 0,
    opacity: colorSettings.opacity ?? 0.7  // 新增透明度設定，預設 70%
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // 停止舊的動畫
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // 重置 frame 計數器，避免累積導致速度異常
    frameRef.current = 0;
    
    img.onload = () => {
      imageRef.current = img;
      
      // 載入遮罩圖片
      const maskImg = new Image();
      maskImg.onload = () => {
        maskImageRef.current = maskImg;
        
        if (isPlaying) {
          startAnimation();
        } else {
          // 靜態顯示
          drawFrame(ctx, img, 0);
        }
      };
      maskImg.onerror = () => {
        // 遮罩載入失敗，靜默處理
      };
      maskImg.src = '/cat-headphone-mask.png';
    };

    img.src = '/cat-headphone.png';

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, size, settings.mode, settings.speed, settings.saturation, settings.lightness, settings.hue, settings.opacity]);

  const drawFrame = (ctx, img, frame) => {
    // 清除畫布
    ctx.clearRect(0, 0, size, size);

    if (!isPlaying) {
      // 靜態時：居中顯示
      const imgSize = size * 0.7; // 圖片佔 70% 大小
      const x = (size - imgSize) / 2;
      const y = (size - imgSize) / 2;
      ctx.drawImage(img, x, y, imgSize, imgSize);
      return;
    }

    // 動畫參數
    const time = frame * 0.05; // 動畫速度
    
    // 1. 跳動效果 (上下 + 左右 + 旋轉)
    const bounceY = Math.sin(time * 2) * 3; // 上下跳動
    const bounceX = Math.sin(time * 1.5) * 2; // 左右搖擺
    const rotation = Math.sin(time * 1.8) * 0.05; // 輕微旋轉
    
    // 2. RGB 色彩變換 (透明區域)
    const hue = (frame * 2) % 360; // 色相旋轉
    
    // 計算圖片位置和大小
    const imgSize = size * 0.75;
    const centerX = size / 2 + bounceX;
    const centerY = size / 2 + bounceY;

    // 保存畫布狀態
    ctx.save();
    
    // 移動到中心點並旋轉
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    
    // === 步驟 1: 先繪製原始耳機圖片（底層） ===
    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
    
    // === 步驟 2: 使用離屏 Canvas 處理 RGB + 遮罩 ===
    if (maskImageRef.current) {
      // 創建離屏 Canvas（使用原圖的實際尺寸）
      const offscreenCanvas = document.createElement('canvas');
      const maskWidth = maskImageRef.current.width;
      const maskHeight = maskImageRef.current.height;
      offscreenCanvas.width = maskWidth;
      offscreenCanvas.height = maskHeight;
      const offCtx = offscreenCanvas.getContext('2d');
      
      // 在離屏 Canvas 上繪製漸變（根據用戶設定）
      const gradient = offCtx.createLinearGradient(0, 0, maskWidth, maskHeight);
      
      // 根據顏色模式決定如何繪製
      if (settings.mode === 'solid') {
        // 純色模式：使用單一顏色
        const color = `hsl(${settings.hue}, ${settings.saturation}%, ${settings.lightness}%)`;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color);
      } else if (settings.mode === 'custom') {
        // 自定義模式：從指定色相開始的漸變，可流動
        const offset = (frame * settings.speed) % 1;
        gradient.addColorStop((0 + offset) % 1, `hsl(${settings.hue}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.25 + offset) % 1, `hsl(${(settings.hue + 60) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.5 + offset) % 1, `hsl(${(settings.hue + 120) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.75 + offset) % 1, `hsl(${(settings.hue + 180) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((1 + offset) % 1, `hsl(${settings.hue}, ${settings.saturation}%, ${settings.lightness}%)`);
      } else {
        // RGB 模式：彩虹流光
        const offset = (frame * settings.speed) % 1;
        gradient.addColorStop((0 + offset) % 1, `hsl(${hue}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.25 + offset) % 1, `hsl(${(hue + 60) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.5 + offset) % 1, `hsl(${(hue + 120) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((0.75 + offset) % 1, `hsl(${(hue + 180) % 360}, ${settings.saturation}%, ${settings.lightness}%)`);
        gradient.addColorStop((1 + offset) % 1, `hsl(${hue}, ${settings.saturation}%, ${settings.lightness}%)`);
      }
      
      offCtx.fillStyle = gradient;
      offCtx.fillRect(0, 0, maskWidth, maskHeight);
      
      // 用遮罩裁剪 RGB（只保留白色區域）- 使用原尺寸繪製遮罩
      offCtx.globalCompositeOperation = 'destination-in';
      offCtx.drawImage(maskImageRef.current, 0, 0, maskWidth, maskHeight);
      
      // 把處理好的 RGB 疊加到主 Canvas（縮放到和耳機圖一樣大）
      // 微調遮罩位置：往上移動 6 像素，往左移動 1 像素
      const offsetX = -1; // 負數 = 往左移
      const offsetY = -6; // 負數 = 往上移
      ctx.globalCompositeOperation = 'screen';
      
      // 使用用戶自訂的透明度
      ctx.globalAlpha = settings.opacity;
      
      ctx.drawImage(offscreenCanvas, -imgSize / 2 + offsetX, -imgSize / 2 + offsetY, imgSize, imgSize);
      ctx.globalAlpha = 1.0; // 恢復透明度
      ctx.globalCompositeOperation = 'source-over';
    }
    
    // 恢復畫布狀態
    ctx.restore();
  };

  const startAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!img || !ctx) return;

    // 如果已經有動畫在運行，先停止
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      frameRef.current += 1;
      drawFrame(ctx, img, frameRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))',
        zIndex: 10
      }}
    />
  );
}


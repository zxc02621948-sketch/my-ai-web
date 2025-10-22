'use client';

import React, { useEffect, useRef, useMemo } from 'react';

const CassettePlayerCanvas = ({ 
  size = 200, 
  isPlaying = false
}) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rotationRef = useRef(0);
  const imagesLoadedRef = useRef(false);

  // 載入圖片資源
  const images = useMemo(() => {
    const img = {};
    
    img.frame = new Image();
    img.frame.src = '/cassette-player/frame-clean.png';
    
    img.reelLeft = new Image();
    img.reelLeft.src = '/cassette-player/reel-left.png';
    
    img.reelRight = new Image();
    img.reelRight.src = '/cassette-player/reel-right.png';

    return img;
  }, []);

  // 等待圖片載入
  useEffect(() => {
    let loadedCount = 0;
    const totalImages = 3;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        imagesLoadedRef.current = true;
        draw(); // 初始繪製
      }
    };

    images.frame.onload = checkLoaded;
    images.reelLeft.onload = checkLoaded;
    images.reelRight.onload = checkLoaded;

    // 如果圖片已經載入完成
    if (images.frame.complete) checkLoaded();
    if (images.reelLeft.complete) checkLoaded();
    if (images.reelRight.complete) checkLoaded();
  }, [images]);

  // 主要繪製函數
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoadedRef.current) return;

    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size / 200;

    // 清除畫布
    ctx.clearRect(0, 0, size, size);

    // 繪製卡帶外框
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.drawImage(images.frame, -100, -100, 200, 200);
    ctx.restore();

    // 卷軸大小（根據 size 調整）
    let reelSize;
    if (size <= 150) {
      reelSize = 30; // 小播放器
    } else if (size <= 170) {
      reelSize = 34; // 中播放器
    } else {
      reelSize = 40; // 大播放器
    }

    // 卷軸位置
    const reelLeftX = centerX + (-24 * scale);
    const reelLeftY = centerY + (-6 * scale);
    const reelRightX = centerX + (24 * scale);
    const reelRightY = centerY + (-6 * scale);

    // 如果正在播放，更新旋轉角度
    if (isPlaying) {
      rotationRef.current += 0.015;
    }

    // 繪製左卷軸
    ctx.save();
    ctx.translate(reelLeftX, reelLeftY);
    ctx.rotate(rotationRef.current);
    ctx.drawImage(images.reelLeft, -reelSize/2, -reelSize/2, reelSize, reelSize);
    ctx.restore();

    // 繪製右卷軸
    ctx.save();
    ctx.translate(reelRightX, reelRightY);
    ctx.rotate(rotationRef.current);
    ctx.drawImage(images.reelRight, -reelSize/2, -reelSize/2, reelSize, reelSize);
    ctx.restore();

    // 持續動畫循環
    animationFrameRef.current = requestAnimationFrame(draw);
  };

  // 啟動動畫循環
  useEffect(() => {
    if (imagesLoadedRef.current) {
      draw();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
};

export default CassettePlayerCanvas;

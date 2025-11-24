"use client";

import { useEffect, useRef } from "react";

function StarrySky() {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const starsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ✅ 性能優化：使用 requestAnimationFrame 和 debounce 優化 resize
    const resizeTimeoutRef = { current: null };
    const resizeCanvas = () => {
      requestAnimationFrame(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // 如果星星已創建，需要重新計算位置
        if (starsRef.current.length > 0) {
          starsRef.current.forEach(star => star.reset());
        }
      });
    };
    
    const handleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(resizeCanvas, 150); // 150ms debounce
    };
    
    resizeCanvas();
    window.addEventListener("resize", handleResize);

    // 星星类
    class Star {
      constructor() {
        this.reset();
        // 决定星星类型：普通星（70%）、亮星（20%）、超亮星（5%）、彩色星（5%）
        const typeRand = Math.random();
        if (typeRand < 0.7) {
          this.type = "normal";
        } else if (typeRand < 0.9) {
          this.type = "bright";
        } else if (typeRand < 0.95) {
          this.type = "superBright";
        } else {
          this.type = "colored";
          // 彩色星星颜色：蓝、青、白、偶尔金色
          const colors = [
            { r: 200, g: 220, b: 255 }, // 淡蓝
            { r: 180, g: 240, b: 255 }, // 淡青
            { r: 255, g: 255, b: 255 }, // 纯白
            { r: 255, g: 240, b: 200 }, // 淡金（较少）
          ];
          this.color = colors[Math.floor(Math.random() * (Math.random() < 0.9 ? 3 : 4))];
        }
      }

      reset() {
        // 随机位置
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        // 星星大小分层（更细致）
        const sizeType = Math.random();
        if (sizeType < 0.5) {
          this.size = Math.random() * 0.4 + 0.3; // 微星星（0.3-0.7px）
        } else if (sizeType < 0.8) {
          this.size = Math.random() * 0.6 + 0.7; // 小星星（0.7-1.3px）
        } else if (sizeType < 0.95) {
          this.size = Math.random() * 1 + 1.3; // 普通星（1.3-2.3px）
        } else {
          this.size = Math.random() * 1.5 + 2.5; // 大星星（2.5-4px）
        }
        
        // 根据类型设置透明度
        if (this.type === "superBright") {
          this.baseOpacity = Math.random() * 0.2 + 0.9;
          this.minOpacity = this.baseOpacity * 0.7;
        } else if (this.type === "bright") {
          this.baseOpacity = Math.random() * 0.25 + 0.75;
          this.minOpacity = this.baseOpacity * 0.6;
        } else {
          this.baseOpacity = Math.random() * 0.35 + 0.4;
          this.minOpacity = this.baseOpacity * 0.35;
        }
        this.opacity = this.baseOpacity;
        this.maxOpacity = this.baseOpacity;
        
        // 闪烁速度（不同类型的星星闪烁速度不同）
        if (this.type === "superBright") {
          this.frequency = Math.random() * 0.015 + 0.008; // 慢闪烁
        } else if (this.type === "bright") {
          this.frequency = Math.random() * 0.02 + 0.01;
        } else {
          this.frequency = Math.random() * 0.03 + 0.015; // 普通星闪烁快一些
        }
        
        // 使用正弦波实现更自然的闪烁
        this.phase = Math.random() * Math.PI * 2; // 初始相位
      }

      update() {
        // 静态闪烁：使用正弦波实现平滑的自然闪烁
        // 不使用线性闪烁，而是用正弦波让闪烁更自然
        const time = Date.now() * 0.001; // 转换为秒
        const sine = Math.sin(time * this.frequency + this.phase);
        // 将正弦波（-1 到 1）映射到透明度范围
        const normalized = (sine + 1) / 2; // 0 到 1
        this.opacity = this.minOpacity + (this.maxOpacity - this.minOpacity) * normalized;
      }

      draw() {
        ctx.save();
        
        // 根据星星类型设置颜色和光晕
        let fillColor, shadowColor, shadowBlur;
        
        if (this.type === "superBright") {
          fillColor = "#ffffff";
          shadowColor = "rgba(255, 255, 255, 1)";
          shadowBlur = this.size * 3.5;
        } else if (this.type === "bright") {
          fillColor = "#ffffff";
          shadowColor = "rgba(255, 255, 255, 0.85)";
          shadowBlur = this.size * 2.5;
        } else if (this.type === "colored") {
          fillColor = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
          shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.6)`;
          shadowBlur = this.size * 2;
        } else {
          fillColor = "#e8e8ff";
          shadowColor = "rgba(232, 232, 255, 0.4)";
          shadowBlur = this.size * 1.2;
        }
        
        ctx.fillStyle = fillColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.globalAlpha = this.opacity;
        
        // 绘制星星主体
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 大星星添加十字光线效果（更精致）
        if (this.size > 2) {
          ctx.shadowBlur = 0; // 光线不需要阴影
          ctx.strokeStyle = fillColor;
          ctx.globalAlpha = this.opacity * 0.6;
          ctx.lineWidth = 0.8;
          
          // 十字光线（长度更长）
          const rayLength = this.size * 2.5;
          ctx.beginPath();
          ctx.moveTo(this.x - rayLength, this.y);
          ctx.lineTo(this.x + rayLength, this.y);
          ctx.moveTo(this.x, this.y - rayLength);
          ctx.lineTo(this.x, this.y + rayLength);
          ctx.stroke();
          
          // 超亮星添加额外的对角线光线
          if (this.type === "superBright" && this.size > 3) {
            ctx.globalAlpha = this.opacity * 0.4;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            const diagLength = this.size * 1.8;
            ctx.moveTo(this.x - diagLength * 0.707, this.y - diagLength * 0.707);
            ctx.lineTo(this.x + diagLength * 0.707, this.y + diagLength * 0.707);
            ctx.moveTo(this.x + diagLength * 0.707, this.y - diagLength * 0.707);
            ctx.lineTo(this.x - diagLength * 0.707, this.y + diagLength * 0.707);
            ctx.stroke();
          }
        }
        
        ctx.restore();
      }
    }

    // ✅ 性能優化：根據設備性能調整星星數量
    // 移動端減少星星數量以提升性能
    const isMobile = window.innerWidth < 768;
    const baseStarCount = Math.floor((canvas.width * canvas.height) / 6000);
    // 移動端：最少100，最多250；桌面端：最少200，最多450
    const starCount = isMobile 
      ? Math.min(250, Math.max(100, Math.floor(baseStarCount * 0.6)))
      : Math.min(450, Math.max(200, baseStarCount));
    starsRef.current = Array.from({ length: starCount }, () => new Star());
    
    // 按大小排序，先绘制小星星，后绘制大星星（确保大星星在上层）
    starsRef.current.sort((a, b) => a.size - b.size);

    // 动画循环
    const animate = () => {
      // 清空画布（静态闪烁不需要拖尾效果，直接清空）
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 更新和绘制所有星星
      starsRef.current.forEach((star) => {
        star.update();
        star.draw();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // 启动动画
    animationFrameRef.current = requestAnimationFrame(animate);

    // 清理函数
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ background: "transparent" }}
    />
  );
}

export default StarrySky;

import React, { useEffect, useRef } from 'react';

const CassettePlayerSVG = ({ isPlaying, size, colorSettings }) => {
  const svgRef = useRef(null);
  const animationRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      if (isPlaying && colorSettings.neonGlow) {
        frameRef.current += 1;
        
        // 更新漸變角度
        const hue = (frameRef.current * colorSettings.speed + colorSettings.hue) % 360;
        
        // 更新 SVG 漸變
        if (svgRef.current) {
          const defs = svgRef.current.querySelector('defs');
          if (defs) {
            const gradient = defs.querySelector('linearGradient');
            if (gradient) {
              gradient.setAttribute('gradientTransform', `rotate(${frameRef.current * 0.5})`);
              
              // 更新顏色
              const stops = gradient.querySelectorAll('stop');
              stops.forEach((stop, index) => {
                const stopHue = (hue + index * 120) % 360;
                stop.setAttribute('stop-color', `hsl(${stopHue}, 100%, 60%)`);
              });
            }
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying && colorSettings.neonGlow) {
      animate();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, colorSettings.neonGlow, colorSettings.speed, colorSettings.hue]);

  const scale = size / 200; // 基準尺寸 200px

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* 卡帶圖片層 - 最底層 */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <img
          src="/cassette-player/frame-clean.png"
          alt="Cassette Frame"
          style={{
            width: size,
            height: size,
            objectFit: 'contain'
          }}
        />
      </div>
      
      {/* SVG 螢光層 - 中間層 */}
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
      >
        <defs>
          {/* 螢光棒漸變 */}
          <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(180, 100%, 60%)" />
            <stop offset="33%" stopColor="hsl(300, 100%, 60%)" />
            <stop offset="66%" stopColor="hsl(60, 100%, 60%)" />
            <stop offset="100%" stopColor="hsl(180, 100%, 60%)" />
          </linearGradient>
          
          {/* 發光濾鏡 */}
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feColorMatrix 
              in="coloredBlur" 
              type="matrix" 
              values="0 0 0 0 0.2
                      0 0 0 0 0.8
                      0 0 0 0 1
                      0 0 0 1 0"
              result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 使用你的 SVG 檔案 */}
        <image
          href="/cassette-player/mask.svg"
          x="0"
          y="-13"
          width="200"
          height="200"
          style={{
            filter: isPlaying && colorSettings.neonGlow ? 
              "invert(1) sepia(1) saturate(5) hue-rotate(180deg) drop-shadow(0 0 10px cyan)" : "none",
            transition: 'all 0.3s ease',
            opacity: isPlaying && colorSettings.neonGlow ? 1 : 0.8
          }}
        />
      </svg>
      
      {/* 卷軸層 */}
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 3 }}>
        {/* 左卷軸 */}
        <div
          style={{
            position: 'absolute',
            left: `${50 + (-24 * scale)}px`,
            top: `${50 + (-6 * scale)}px`,
            width: `${40 * scale}px`,
            height: `${40 * scale}px`,
            transform: `rotate(${isPlaying ? frameRef.current * 2 : 0}deg)`,
            transformOrigin: 'center',
            transition: 'transform 0.1s linear'
          }}
        >
          <img
            src="/cassette-player/reel-left.png"
            alt="Left Reel"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
        
        {/* 右卷軸 */}
        <div
          style={{
            position: 'absolute',
            left: `${50 + (24 * scale)}px`,
            top: `${50 + (-6 * scale)}px`,
            width: `${40 * scale}px`,
            height: `${40 * scale}px`,
            transform: `rotate(${isPlaying ? frameRef.current * 2 : 0}deg)`,
            transformOrigin: 'center',
            transition: 'transform 0.1s linear'
          }}
        >
          <img
            src="/cassette-player/reel-right.png"
            alt="Right Reel"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CassettePlayerSVG;

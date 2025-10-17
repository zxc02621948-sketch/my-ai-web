'use client';

import { useState, useEffect } from 'react';

export default function HeadphoneColorSettings({ isOpen, onClose, settings, onSettingsChange }) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key, value) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const colorModes = [
    { value: 'rgb', label: 'RGB 流光', icon: '🌈' },
    { value: 'solid', label: '純色', icon: '🎨' },
    { value: 'custom', label: '自定義', icon: '✨' }
  ];

  const speeds = [
    { value: 0.01, label: '慢' },
    { value: 0.02, label: '中' },
    { value: 0.03, label: '快' }
  ];

  const presetColors = [
    { name: '紅色', hue: 0 },
    { name: '橙色', hue: 30 },
    { name: '黃色', hue: 60 },
    { name: '綠色', hue: 120 },
    { name: '青色', hue: 180 },
    { name: '藍色', hue: 240 },
    { name: '紫色', hue: 280 },
    { name: '粉色', hue: 320 }
  ];

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">耳機顏色設定</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* 顏色模式選擇 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            顏色模式
          </label>
          <div className="grid grid-cols-3 gap-2">
            {colorModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => handleChange('mode', mode.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  localSettings.mode === mode.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">{mode.icon}</div>
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {mode.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RGB 模式設定 */}
        {localSettings.mode === 'rgb' && (
          <>
            {/* 流動速度 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                流動速度
              </label>
              <div className="flex gap-2">
                {speeds.map((speed) => (
                  <button
                    key={speed.value}
                    onClick={() => handleChange('speed', speed.value)}
                    className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                      localSettings.speed === speed.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 飽和度 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                飽和度: {localSettings.saturation}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.saturation}
                onChange={(e) => handleChange('saturation', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 亮度 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                亮度: {localSettings.lightness}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.lightness}
                onChange={(e) => handleChange('lightness', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </>
        )}

        {/* 純色模式設定 */}
        {localSettings.mode === 'solid' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              選擇顏色
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {presetColors.map((color) => (
                <button
                  key={color.hue}
                  onClick={() => handleChange('hue', color.hue)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    localSettings.hue === color.hue
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: `hsl(${color.hue}, 70%, 60%)`
                  }}
                  title={color.name}
                >
                  <div className="text-xs font-medium text-white drop-shadow">
                    {color.name}
                  </div>
                </button>
              ))}
            </div>

            {/* 飽和度 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                飽和度: {localSettings.saturation}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.saturation}
                onChange={(e) => handleChange('saturation', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 亮度 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                亮度: {localSettings.lightness}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.lightness}
                onChange={(e) => handleChange('lightness', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* 自定義模式設定 */}
        {localSettings.mode === 'custom' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              自定義漸變
            </label>
            
            {/* 色相 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                色相: {localSettings.hue}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={localSettings.hue}
                onChange={(e) => handleChange('hue', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 飽和度 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                飽和度: {localSettings.saturation}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.saturation}
                onChange={(e) => handleChange('saturation', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 亮度 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                亮度: {localSettings.lightness}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.lightness}
                onChange={(e) => handleChange('lightness', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 流動速度 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                流動速度
              </label>
              <div className="flex gap-2">
                {speeds.map((speed) => (
                  <button
                    key={speed.value}
                    onClick={() => handleChange('speed', speed.value)}
                    className={`flex-1 py-2 rounded-lg border-2 transition-all text-sm ${
                      localSettings.speed === speed.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 顏色預覽 */}
            <div className="mt-3 p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                預覽
              </div>
              <div
                className="w-full h-12 rounded-lg"
                style={{
                  background: `linear-gradient(90deg, 
                    hsl(${localSettings.hue}, ${localSettings.saturation}%, ${localSettings.lightness}%), 
                    hsl(${(localSettings.hue + 60) % 360}, ${localSettings.saturation}%, ${localSettings.lightness}%), 
                    hsl(${(localSettings.hue + 120) % 360}, ${localSettings.saturation}%, ${localSettings.lightness}%), 
                    hsl(${(localSettings.hue + 180) % 360}, ${localSettings.saturation}%, ${localSettings.lightness}%)
                  )`
                }}
              />
            </div>
          </div>
        )}

        {/* 重置按鈕 */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => {
              const defaultSettings = {
                mode: 'rgb',
                speed: 0.02,
                saturation: 50,
                lightness: 60,
                hue: 0
              };
              setLocalSettings(defaultSettings);
              onSettingsChange(defaultSettings);
            }}
            className="flex-1 py-2 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}


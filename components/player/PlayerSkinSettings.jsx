'use client';

import { useState, useEffect } from 'react';
import CatHeadphoneCanvas from '@/components/player/CatHeadphoneCanvas';
import CassettePlayerCanvas from '@/components/player/CassettePlayerCanvas';
import axios from 'axios';

export default function PlayerSkinSettings({ currentUser, onSettingsSaved }) {
  const [settings, setSettings] = useState({
    mode: 'rgb',
    speed: 0.02,
    saturation: 50,
    lightness: 60,
    hue: 0,
    opacity: 0.7,
    neonGlow: false // 螢光棒流光效果
  });
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false); // 預覽預設為暫停
  const [switching, setSwitching] = useState(false); // 造型切換中

  // 載入用戶設定
  useEffect(() => {
    if (currentUser?.playerSkinSettings) {
      setSettings(currentUser.playerSkinSettings);
    }
  }, [currentUser]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSwitchSkin = async (skinId) => {
    setSwitching(true);
    setSaveMessage('');
    
    try {
      const response = await axios.post('/api/player/switch-skin', { skinId });
      
      if (response.data.success) {
        setSaveMessage(`✅ ${response.data.message} 正在刷新...`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('切換造型失敗:', error);
      setSaveMessage('❌ 切換失敗：' + (error.response?.data?.error || '伺服器錯誤'));
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setSwitching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    
    try {
      const response = await axios.post('/api/player/skin-settings', settings);
      
      if (response.data.success) {
        setSaveMessage('✅ 設定已保存！正在刷新...');
        if (onSettingsSaved) {
          onSettingsSaved(response.data.settings);
        }
        // 刷新頁面以載入新設定
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('保存設定失敗:', error);
      setSaveMessage('❌ 保存失敗：' + (error.response?.data?.error || '伺服器錯誤'));
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const colorModes = [
    { value: 'rgb', label: 'RGB 流光', icon: '🌈', desc: '彩虹漸變流動效果' },
    { value: 'solid', label: '純色', icon: '🎨', desc: '單一顏色發光' },
    { value: 'custom', label: '自定義漸變', icon: '✨', desc: '自選色相的漸變流光' }
  ];

  const speeds = [
    { value: 0.01, label: '慢速', icon: '🐢' },
    { value: 0.02, label: '中速', icon: '🚶' },
    { value: 0.03, label: '快速', icon: '🏃' },
    { value: 0.05, label: '超快', icon: '⚡' }
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
  
  const [showCustomHue, setShowCustomHue] = useState(false);

  // 檢查是否有高階造型權限
  const hasPremiumSkin = currentUser?.premiumPlayerSkin;

  if (!hasPremiumSkin) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 border-2 border-purple-200 dark:border-purple-800">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            高階播放器造型
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            解鎖超酷的貓咪耳機 RGB 流光動畫！
          </p>
          
          {/* 預覽效果 */}
          <div className="mb-6 relative inline-block">
            <div className="w-40 h-40 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center relative overflow-visible">
              <CassettePlayerCanvas 
                isPlaying={true} 
                size={150} 
                colorSettings={{
                  mode: 'rgb',
                  speed: 0.02,
                  saturation: 50,
                  lightness: 60,
                  hue: 0
                }}
              />
            </div>
            <div className="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-70 dark:bg-opacity-70 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
              <div className="text-4xl drop-shadow-lg">🔒</div>
            </div>
          </div>
          
          <a 
            href="/store"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-lg"
          >
            前往商店購買 ✨
          </a>
        </div>
      </div>
    );
  }

  // 當前啟用的造型
  const activeSkin = currentUser?.activePlayerSkin || 'default';
  
  // 可用的造型列表（根據購買狀態動態生成）
  const availableSkins = [
    { id: 'default', name: '預設造型', icon: '🎧', description: '經典播放器外觀', requiresPurchase: false },
    { id: 'cassette-player', name: '卡帶播放器', icon: '🎵', description: '復古卡帶 + 樂譜動畫', requiresPurchase: true, isPremium: true },
    { id: 'cat-headphone', name: '貓咪耳機', icon: '🐱', description: 'RGB 流光動畫', requiresPurchase: true, isPremium: true }
    // 未來可以在這裡新增更多造型，例如：
    // { id: 'neon-glow', name: '霓虹光暈', icon: '💫', description: '賽博朋克風格', requiresPurchase: true, isPremium: true }
  ];
  
  // 過濾出用戶可用的造型（已購買或免費造型）
  const userAvailableSkins = availableSkins.filter(skin => {
    if (!skin.requiresPurchase) return true; // 免費造型
    if (skin.isPremium) return currentUser?.premiumPlayerSkin; // 高階造型需要購買
    return false;
  });
  
  // 獲取當前造型的資訊
  const currentSkinInfo = availableSkins.find(s => s.id === activeSkin) || availableSkins[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎨</span>
            播放器造型設定
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            當前造型：{currentSkinInfo.icon} {currentSkinInfo.name}
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* 造型選擇下拉選單 */}
          <div className="relative">
            <select
              value={activeSkin}
              onChange={(e) => handleSwitchSkin(e.target.value)}
              disabled={switching}
              className="px-4 py-2 pr-10 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-all shadow-md hover:shadow-lg appearance-none cursor-pointer font-medium"
              style={{ minWidth: '180px' }}
            >
              {userAvailableSkins.map(skin => (
                <option key={skin.id} value={skin.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  {skin.icon} {skin.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white">
              ▼
            </div>
          </div>
          
          {/* 保存按鈕 */}
          <button
            onClick={handleSave}
            disabled={saving || activeSkin === 'default'}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
            title={activeSkin === 'default' ? '預設造型無需自定義設定' : ''}
          >
            {saving ? '保存中...' : '💾 保存設定'}
          </button>
        </div>
      </div>

      {/* 保存提示訊息 */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg ${
          saveMessage.includes('✅') 
            ? 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 根據造型顯示不同內容 */}
      {activeSkin === 'default' ? (
        // 預設造型：顯示友好提示
        <div className="text-center py-12">
          <div className="inline-block bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl p-8 border-2 border-blue-200 dark:border-blue-800">
            <div className="text-6xl mb-4">🎧</div>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              預設播放器
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              採用簡潔設計，無需額外調整
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              ✨ 當前已啟用預設造型
            </div>
          </div>
        </div>
      ) : activeSkin === 'cassette-player' || activeSkin === 'cat-headphone' ? (
        // 卡帶播放器或貓咪耳機造型：顯示調整介面
        <div className="grid md:grid-cols-2 gap-6">
          {/* 左側：設定選項 */}
          <div className="space-y-6">
          
          {/* 卡帶播放器專屬：螢光棒流光效果 */}
          {activeSkin === 'cassette-player' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                🎵 卡帶特效
              </label>
              <div className="space-y-3">
                {/* 螢光棒流光效果開關 */}
                <div className="p-4 bg-gradient-to-br from-cyan-50 via-purple-50 to-pink-50 dark:from-cyan-900/30 dark:via-purple-900/30 dark:to-pink-900/30 rounded-xl border-2 border-cyan-300 dark:border-cyan-600">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white mb-1">
                        🌟 螢光棒流光效果
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        播放時外框會像螢光棒一樣流動發光
                      </div>
                    </div>
                    <button
                      onClick={() => handleChange('neonGlow', !settings.neonGlow)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        settings.neonGlow 
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                          settings.neonGlow ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 顏色模式選擇 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              顏色模式
            </label>
            <div className="grid grid-cols-1 gap-3">
              {colorModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handleChange('mode', mode.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    settings.mode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 shadow-md scale-105'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 hover:shadow'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{mode.icon}</span>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {mode.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {mode.desc}
                      </div>
                    </div>
                    {settings.mode === mode.value && (
                      <span className="text-blue-500">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 流動速度（RGB 和自定義模式） */}
          {(settings.mode === 'rgb' || settings.mode === 'custom') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                流動速度
              </label>
              <div className="grid grid-cols-4 gap-2">
                {speeds.map((speed) => (
                  <button
                    key={speed.value}
                    onClick={() => handleChange('speed', speed.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      settings.speed === speed.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shadow-md'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{speed.icon}</div>
                    <div className="text-xs font-medium">{speed.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 純色預設顏色選擇 */}
          {settings.mode === 'solid' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                選擇顏色
              </label>
              <div className="grid grid-cols-4 gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color.hue}
                    onClick={() => {
                      handleChange('hue', color.hue);
                      setShowCustomHue(false);
                    }}
                    className={`h-12 rounded-lg border-2 transition-all ${
                      settings.hue === color.hue && !showCustomHue
                        ? 'border-blue-500 scale-110 shadow-lg'
                        : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: `hsl(${color.hue}, ${settings.saturation}%, ${settings.lightness}%)`
                    }}
                    title={color.name}
                  />
                ))}
                
                {/* 自定義顏色按鈕 */}
                <button
                  onClick={() => setShowCustomHue(!showCustomHue)}
                  className={`h-12 rounded-lg border-2 transition-all flex items-center justify-center text-sm font-medium ${
                    showCustomHue
                      ? 'border-blue-500 scale-110 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 text-blue-600 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                  title="自定義色相"
                >
                  🎨
                </button>
              </div>
              
              {/* 自定義色相滑桿 */}
              {showCustomHue && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    自定義色相: {settings.hue}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={settings.hue}
                    onChange={(e) => handleChange('hue', parseInt(e.target.value))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, 
                        hsl(0, 100%, 50%), 
                        hsl(60, 100%, 50%), 
                        hsl(120, 100%, 50%), 
                        hsl(180, 100%, 50%), 
                        hsl(240, 100%, 50%), 
                        hsl(300, 100%, 50%), 
                        hsl(360, 100%, 50%)
                      )`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>紅</span>
                    <span>黃</span>
                    <span>綠</span>
                    <span>青</span>
                    <span>藍</span>
                    <span>紫</span>
                    <span>紅</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 色相滑桿（自定義模式） */}
          {settings.mode === 'custom' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                色相: {settings.hue}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={settings.hue}
                onChange={(e) => handleChange('hue', parseInt(e.target.value))}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(0, 100%, 50%), 
                    hsl(60, 100%, 50%), 
                    hsl(120, 100%, 50%), 
                    hsl(180, 100%, 50%), 
                    hsl(240, 100%, 50%), 
                    hsl(300, 100%, 50%), 
                    hsl(360, 100%, 50%)
                  )`
                }}
              />
            </div>
          )}

          {/* 飽和度滑桿 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              飽和度: {settings.saturation}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.saturation}
              onChange={(e) => handleChange('saturation', parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>低</span>
              <span>高</span>
            </div>
          </div>

          {/* 亮度滑桿 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              亮度: {settings.lightness}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.lightness}
              onChange={(e) => handleChange('lightness', parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-black via-gray-500 to-white"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>暗</span>
              <span>亮</span>
            </div>
          </div>

          {/* 透明度滑桿 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              透明度: {Math.round(settings.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.opacity * 100}
              onChange={(e) => handleChange('opacity', parseInt(e.target.value) / 100)}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-transparent via-blue-300 to-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>透明</span>
              <span>不透明</span>
            </div>
          </div>

          {/* 重置按鈕 */}
          <button
            onClick={() => {
              const defaultSettings = {
                mode: 'rgb',
                speed: 0.02,
                saturation: 50,
                lightness: 60,
                hue: 0,
                opacity: 0.7
              };
              setSettings(defaultSettings);
            }}
            className="w-full py-2 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            🔄 重置為預設值
          </button>
        </div>

        {/* 右側：即時預覽 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              即時預覽
            </label>
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-8 border-2 border-gray-300 dark:border-gray-600 relative">
              {/* 預覽播放器 */}
              <div className="w-full aspect-square max-w-[200px] mx-auto bg-white dark:bg-gray-700 rounded-2xl shadow-2xl flex items-center justify-center relative overflow-visible">
                {activeSkin === 'cat-headphone' ? (
                  <CatHeadphoneCanvas 
                    key={`preview-${isPlaying ? 'playing' : 'paused'}`}
                    isPlaying={isPlaying} 
                    size={130} 
                    colorSettings={settings}
                  />
                ) : activeSkin === 'cassette-player' ? (
                  <CassettePlayerCanvas 
                    key={`preview-${isPlaying ? 'playing' : 'paused'}`}
                    isPlaying={isPlaying} 
                    size={150} 
                    colorSettings={settings}
                  />
                ) : (
                  <div className="text-gray-400 text-sm">預設造型</div>
                )}
              </div>
              
              {/* 播放/暫停切換 */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="mt-4 w-full py-2 px-4 bg-white dark:bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
              >
                {isPlaying ? '⏸️ 暫停預覽' : '▶️ 播放預覽'}
              </button>
            </div>
          </div>

          {/* 當前設定摘要 */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              當前設定
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>模式：</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {colorModes.find(m => m.value === settings.mode)?.label}
                </span>
              </div>
              {(settings.mode === 'rgb' || settings.mode === 'custom') && (
                <div className="flex justify-between">
                  <span>速度：</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {speeds.find(s => s.value === settings.speed)?.label || '自訂'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>飽和度：</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {settings.saturation}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>亮度：</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {settings.lightness}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>透明度：</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.round(settings.opacity * 100)}%
                </span>
              </div>
              {(settings.mode === 'solid' || settings.mode === 'custom') && (
                <div className="flex justify-between">
                  <span>色相：</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {settings.hue}°
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 使用提示 */}
          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
            <div className="text-xs text-blue-700 dark:text-blue-300">
              💡 <strong>提示：</strong>設定會在所有頁面的播放器生效，包括小播放器！
            </div>
          </div>
        </div>
      </div>
      ) : (
        // 其他造型（如果有的話）
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">該造型暫無自定義設定</div>
        </div>
      )}
    </div>
  );
}


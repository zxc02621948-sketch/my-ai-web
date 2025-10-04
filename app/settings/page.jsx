"use client";
import { useEffect, useState } from "react";
import { usePlayer } from "../../components/context/PlayerContext";

export default function SettingsPage() {
  const { play, pause, setVolume } = usePlayer() || {};
  const [autoplaySound, setAutoplaySound] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem("player.autoplaySound");
      if (v === "true" || v === "false") setAutoplaySound(v === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("player.autoplaySound", autoplaySound ? "true" : "false");
    } catch {}
  }, [autoplaySound]);

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: "16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>播放器設定</h1>
      <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="checkbox"
            checked={autoplaySound}
            onChange={(e) => setAutoplaySound(e.target.checked)}
          />
          <span>允許自動播放（有聲）</span>
        </label>
        <p style={{ color: "#6b7280", marginTop: 8 }}>
          若瀏覽器因政策阻擋有聲自動播放，播放器會嘗試播放但可能需要互動解除靜音。
        </p>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => { try { setVolume?.(1); play?.(); } catch {} }}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        >
          立即測試播放
        </button>
        <button
          onClick={() => { try { pause?.(); } catch {} }}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        >
          暫停
        </button>
      </div>
    </div>
  );
}
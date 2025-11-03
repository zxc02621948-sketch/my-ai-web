import { useRef, useState } from "react";
import { X, Trash2, Clipboard } from "lucide-react";
import { GENRE_MAP } from "@/constants/musicCategories";

export default function MusicInfoBox({
  music,
  currentUser,
  displayMode = "gallery",
  onClose,
  onDelete,
  canEdit = false,
  onEdit,
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [copyTip, setCopyTip] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // —— 1 秒冷卻（前端）——
  const [cooling, setCooling] = useState({});
  const cooldownMs = 1000;
  function startCooldown(key, ms = cooldownMs) {
    setCooling((s) => ({ ...s, [key]: true }));
    setTimeout(() => setCooling((s) => ({ ...s, [key]: false })), ms);
  }
  function withCooldown(key, fn, ms = cooldownMs) {
    return (...args) => {
      if (cooling[key]) return;
      startCooldown(key, ms);
      fn?.(...args);
    };
  }

  // 複製到剪貼簿
  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedField(fieldName);
        setCopyTip(`已複製 ${fieldName}`);
        setTimeout(() => {
          setCopiedField(null);
          setCopyTip("");
        }, 2000);
      })
      .catch(() => {
        setCopyTip(`複製失敗`);
      });
  };

  // 檢查是否為音樂擁有者
  const isOwner =
    currentUser &&
    music?.author?._id &&
    String(currentUser._id) === String(music.author._id);

  // 檢查是否為管理員
  const isAdmin = currentUser?.isAdmin === true;

  // 檢查是否可以編輯
  const canEditMusic = canEdit && isOwner;

  // 檢查是否可以刪除（擁有者或管理員）
  const canDeleteMusic = (isOwner || isAdmin) && onDelete;

  return (
    <div className="space-y-4">
      {/* 標題和操作按鈕 */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white mb-1 break-words">
            {music.title || "未命名音樂"}
          </h2>
          {music.description && (
            <p className="text-gray-400 text-sm break-words">
              {music.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* 編輯按鈕 */}
          {canEditMusic && onEdit && (
            <button
              onClick={onEdit}
              className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
              title="編輯音樂"
            >
              <Clipboard size={16} className="text-blue-400" />
            </button>
          )}

          {/* 刪除按鈕 */}
          {canDeleteMusic && (
            <button
              onClick={() => {
                const confirmMessage =
                  isAdmin && !isOwner
                    ? "⚠️ 管理員權限：確定要刪除這首音樂嗎？此操作無法復原。"
                    : "確定要刪除這首音樂嗎？此操作無法復原。";

                if (window.confirm(confirmMessage)) {
                  onDelete(music._id);
                }
              }}
              className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              title={isAdmin && !isOwner ? "管理員刪除音樂" : "刪除音樂"}
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* 分級 */}
      {music.rating && (
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 text-sm rounded ${
              music.rating === "18"
                ? "bg-red-500/20 text-red-300"
                : music.rating === "all"
                  ? "bg-green-500/20 text-green-300"
                  : "bg-yellow-500/20 text-yellow-300"
            }`}
          >
            {music.rating === "18"
              ? "🔞 18+"
              : music.rating === "all"
                ? "✅ 全年齡"
                : `${music.rating}+`}
          </span>
        </div>
      )}

      {/* 類型 */}
      {music.category && (
        <div>
          <div className="text-sm text-gray-300 mb-2">
            類型: {music.category === "song" ? "🎤 歌曲" : "🎵 BGM"}
          </div>
        </div>
      )}

      {/* 語言 */}
      {music.language && (
        <div>
          <div className="text-sm text-gray-300 mb-2">
            語言:{" "}
            {music.language === "chinese"
              ? "中文"
              : music.language === "english"
                ? "英文"
                : music.language === "japanese"
                  ? "日文"
                  : music.language}
          </div>
        </div>
      )}

      {/* 風格 */}
      {music.genre && music.genre.length > 0 && (
        <div>
          <div className="text-sm text-gray-300 mb-2">風格</div>
          <div className="flex flex-wrap gap-2">
            {music.genre.map((genreKey, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors cursor-pointer"
                onClick={() => copyToClipboard(genreKey, "風格")}
                title="點擊複製"
              >
                {GENRE_MAP[genreKey] || genreKey}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 標籤 */}
      {music.tags && music.tags.length > 0 && (
        <div>
          <div className="text-sm text-gray-300 mb-2">標籤</div>
          <div className="flex flex-wrap gap-2">
            {music.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors cursor-pointer"
                onClick={() => copyToClipboard(tag, "標籤")}
                title="點擊複製"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ✅ 歌曲專用屬性 */}
      {music.category === "song" && (music.lyrics || music.singerGender) && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="text-sm text-gray-300 font-medium">歌曲資訊</div>

          {music.lyrics && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">歌詞</span>
                <button
                  onClick={withCooldown("copy.lyrics", () =>
                    copyToClipboard(music.lyrics, "歌詞"),
                  )}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                  disabled={!!cooling["copy.lyrics"]}
                >
                  {copiedField === "歌詞" ? "已複製" : "複製"}
                </button>
              </div>
              <div className="p-2 bg-zinc-800 rounded text-sm text-gray-300 whitespace-pre-wrap break-words">
                {music.lyrics}
              </div>
            </div>
          )}

          {music.singerGender && (
            <div className="p-2 bg-zinc-800 rounded">
              <div className="text-xs text-gray-400 mb-1">歌手性別</div>
              <div className="text-white text-sm">
                {music.singerGender === "male"
                  ? "男"
                  : music.singerGender === "female"
                    ? "女"
                    : music.singerGender === "mixed"
                      ? "混合"
                      : music.singerGender === "n/a"
                        ? "不適用"
                        : music.singerGender}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ 技術參數區塊：只要有元數據就直接顯示 */}
      {(music.prompt ||
        music.platform ||
        music.modelName ||
        music.modelLink ||
        music.tempo ||
        music.key ||
        music.seed ||
        music.weirdness !== null ||
        music.styleInfluence !== null ||
        music.excludeStyles) && (
        <>
          {/* AI 生成資訊 */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="text-sm text-gray-300 font-medium">AI 生成參數</div>

            {/* 平台 */}
            {music.platform && (
              <div className="p-2 bg-zinc-800 rounded">
                <div className="text-gray-400 text-xs mb-1">生成平台</div>
                <div className="text-white text-sm">{music.platform}</div>
              </div>
            )}

            {music.prompt && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">提示詞</span>
                  <button
                    onClick={withCooldown("copy.prompt", () =>
                      copyToClipboard(music.prompt, "提示詞"),
                    )}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    disabled={!!cooling["copy.prompt"]}
                  >
                    {copiedField === "提示詞" ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="p-2 bg-zinc-800 rounded text-sm text-gray-300 break-words">
                  {music.prompt}
                </div>
              </div>
            )}

            {/* 模型資訊 */}
            {(music.modelName || music.modelLink) && (
              <div className="grid grid-cols-1 gap-2 text-xs">
                {music.modelName && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">模型名稱</div>
                    <div className="text-white">{music.modelName}</div>
                  </div>
                )}
                {music.modelLink && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">模型連結</div>
                    <a
                      href={music.modelLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {music.modelLink}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 技術參數 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {music.tempo && (
                <div className="p-2 bg-zinc-800 rounded">
                  <div className="text-gray-400 mb-1">BPM</div>
                  <div className="text-white">{music.tempo}</div>
                </div>
              )}
              {music.key && (
                <div className="p-2 bg-zinc-800 rounded">
                  <div className="text-gray-400 mb-1">調性</div>
                  <div className="text-white">{music.key}</div>
                </div>
              )}
              {music.weirdness !== null && music.weirdness !== undefined && (
                <div className="p-2 bg-zinc-800 rounded">
                  <div className="text-gray-400 mb-1">怪異度</div>
                  <div className="text-white">{music.weirdness}%</div>
                </div>
              )}
              {music.styleInfluence !== null &&
                music.styleInfluence !== undefined && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">風格影響力</div>
                    <div className="text-white">{music.styleInfluence}%</div>
                  </div>
                )}
            </div>

            {music.excludeStyles && (
              <div className="p-2 bg-zinc-800 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">排除風格</span>
                  <button
                    onClick={withCooldown("copy.excludeStyles", () =>
                      copyToClipboard(music.excludeStyles, "排除風格"),
                    )}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    disabled={!!cooling["copy.excludeStyles"]}
                  >
                    {copiedField === "排除風格" ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="text-white text-sm break-words">
                  {music.excludeStyles}
                </div>
              </div>
            )}

            {music.seed && (
              <div className="p-2 bg-zinc-800 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Seed</span>
                  <button
                    onClick={withCooldown("copy.seed", () =>
                      copyToClipboard(music.seed, "Seed"),
                    )}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    disabled={!!cooling["copy.seed"]}
                  >
                    {copiedField === "Seed" ? "已複製" : "複製"}
                  </button>
                </div>
                <div className="text-white font-mono text-sm">{music.seed}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 複製提示 */}
      {copyTip && (
        <div className="text-center">
          <span className="text-xs text-emerald-400">{copyTip}</span>
        </div>
      )}
    </div>
  );
}



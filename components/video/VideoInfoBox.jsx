import { useRef, useState, useMemo } from "react";
import { X, Trash2, Download, Clipboard, Pencil, AlertTriangle, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/common/GlobalNotificationManager";
import PowerCouponButton from "@/components/power-coupon/PowerCouponButton";
import { getPlatformUrl } from "@/constants/platformUrls";

export default function VideoInfoBox({ 
  video, 
  currentUser, 
  displayMode = "gallery", 
  onClose, 
  onDelete, 
  canEdit = false,
  onEdit
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [copyTip, setCopyTip] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();
  
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
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setCopyTip(`已複製 ${fieldName}`);
      setTimeout(() => {
        setCopiedField(null);
        setCopyTip("");
      }, 2000);
    }).catch(() => {
      setCopyTip(`複製失敗`);
    });
  };

  // 多筆切分（支援換行、半形/全形逗號、頓號）
  const splitList = (s) =>
    String(s || "")
      .split(/\r?\n|,|、|，/g)
      .map((x) => x.trim())
      .filter(Boolean);

  // 檢查是否為影片擁有者
  const isOwner = currentUser && video?.author?._id && 
    String(currentUser._id) === String(video.author._id);

  // 檢查是否為管理員
  const isAdmin = currentUser?.isAdmin === true;

  // 檢查是否可以編輯
  const canEditVideo = canEdit && isOwner;

  // 檢查是否可以刪除（擁有者或管理員）
  const canDeleteVideo = (isOwner || isAdmin) && onDelete;

  return (
    <div className="space-y-4">
      {/* 標題和操作按鈕 */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white mb-1 break-words">
            {video.title || "未命名影片"}
          </h2>
          {video.description && (
            <p className="text-gray-400 text-sm break-words">
              {video.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {/* 加成券使用按鈕；僅作者可見 */}
          {isOwner && (
            <div onClick={(e) => e.stopPropagation()}>
              <PowerCouponButton
                contentType="video"
                contentId={video._id}
                contentTitle={video.title || "影片"}
                onSuccess={() => window.location.reload()}
              />
            </div>
          )}

          {/* 編輯按鈕 */}
          {canEditVideo && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded shadow transition"
              title="編輯影片資料"
            >
              <Pencil size={16} />
              <span>編輯</span>
            </button>
          )}
          
          {/* 刪除按鈕 */}
          {canDeleteVideo && (
            <button
              onClick={() => {
                const confirmMessage = isAdmin && !isOwner
                  ? '⚠️ 管理員權限：確定要刪除這部影片嗎？此操作無法復原。'
                  : '確定要刪除這部影片嗎？此操作無法復原。';
                
                notify.confirm(
                  "確認刪除",
                  confirmMessage
                ).then((confirmed) => {
                  if (confirmed) {
                    onDelete(video._id);
                  }
                });
              }}
              className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              title={isAdmin && !isOwner ? "管理員刪除影片" : "刪除影片"}
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          )}
          
          {/* 關閉按鈕 */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
            title="關閉"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>


      {/* 分級 */}
      {video.rating && (
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-sm rounded ${
            video.rating === '18' 
              ? 'bg-red-500/20 text-red-300' 
              : video.rating === 'sfw'
              ? 'bg-green-500/20 text-green-300'
              : 'bg-yellow-500/20 text-yellow-300'
          }`}>
            {video.rating === '18' ? '🔞 18+' : video.rating === 'sfw' ? '✅ 全年齡' : `${video.rating}+`}
          </span>
        </div>
      )}

      {/* 分類 */}
      {(() => {
        // 優先使用 categories 數組，如果沒有則使用 category 單個值
        const categoriesToShow = Array.isArray(video.categories) && video.categories.length > 0
          ? video.categories
          : video.category
            ? [video.category]
            : [];

        if (categoriesToShow.length === 0) return null;

        return (
          <div>
            <div className="text-sm text-gray-300 mb-2">分類：{categoriesToShow.join("、")}</div>
          </div>
        );
      })()}

      {/* 標籤 */}
      {video.tags && video.tags.length > 0 && (
        <div>
          <div className="text-sm text-gray-300 mb-2">標籤</div>
          <div className="flex flex-wrap gap-2">
            {video.tags.map((tag, index) => (
              <button
                key={index}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  // ✅ 跳轉到影片專區的搜尋頁面
                  router.push(`/videos?search=${encodeURIComponent(tag)}`);
                  onClose?.();
                }}
                title="點擊搜尋此標籤"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ✅ 技術參數區塊：只要有元數據就直接顯示 */}
      {(video.prompt || video.negativePrompt || video.platform || video.fps || video.resolution || video.steps || video.cfgScale || video.seed) && (
        <>
          {/* AI 生成資訊 */}
          <div className="space-y-3">
            <div className="text-sm text-gray-300 font-medium">AI 生成參數</div>
            
            {/* 平台 */}
            {video.platform && (
              <div className="p-2 bg-zinc-800 rounded">
                <div className="text-gray-400 text-xs mb-1">生成平台</div>
                <div className="text-white text-sm">
                  {(() => {
                    const platform = video.platform;
                    
                    // 檢查是否有官方網站連結
                    const platformUrl = getPlatformUrl(platform);
                    
                    if (platformUrl) {
                      const isInternalLink = platformUrl.startsWith("/");
                      return (
                        <a
                          href={platformUrl}
                          {...(isInternalLink ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          {platform}
                        </a>
                      );
                    }
                    
                    return <span>{platform}</span>;
                  })()}
                </div>
              </div>
            )}
            
            {video.prompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">正面提示詞</span>
                    <button
                      onClick={withCooldown("copy.prompt", () => copyToClipboard(video.prompt, "正面提示詞"))}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      disabled={!!cooling["copy.prompt"]}
                    >
                      {copiedField === "正面提示詞" ? "已複製" : "複製"}
                    </button>
                  </div>
                  <div className="p-2 bg-zinc-800 rounded text-sm text-gray-300 break-words">
                    {video.prompt}
                  </div>
                </div>
              )}

              {video.negativePrompt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">負面提示詞</span>
                    <button
                      onClick={withCooldown("copy.negative", () => copyToClipboard(video.negativePrompt, "負面提示詞"))}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      disabled={!!cooling["copy.negative"]}
                    >
                      {copiedField === "負面提示詞" ? "已複製" : "複製"}
                    </button>
                  </div>
                  <div className="p-2 bg-zinc-800 rounded text-sm text-gray-300 break-words">
                    {video.negativePrompt}
                  </div>
                </div>
              )}

              {/* 技術參數 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {video.resolution && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">解析度</div>
                    <div className="text-white">{video.resolution}</div>
                  </div>
                )}
                {video.fps && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">FPS</div>
                    <div className="text-white">{video.fps}</div>
                  </div>
                )}
                {video.steps && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">步數</div>
                    <div className="text-white">{video.steps}</div>
                  </div>
                )}
                {video.cfgScale && (
                  <div className="p-2 bg-zinc-800 rounded">
                    <div className="text-gray-400 mb-1">CFG Scale</div>
                    <div className="text-white">{video.cfgScale}</div>
                  </div>
                )}
              </div>

              {video.seed && (
                <div className="p-2 bg-zinc-800 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Seed</span>
                    <button
                      onClick={withCooldown("copy.seed", () => copyToClipboard(video.seed, "Seed"))}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      disabled={!!cooling["copy.seed"]}
                    >
                      {copiedField === "Seed" ? "已複製" : "複製"}
                    </button>
                  </div>
                  <div className="text-white font-mono text-sm">{video.seed}</div>
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

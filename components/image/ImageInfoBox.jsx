import { useRef, useState, useMemo, useEffect } from "react";
import axios from "axios";
import { X, Trash2, Download, Clipboard, Pencil, AlertTriangle, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/common/GlobalNotificationManager";
import ShareButton from "@/components/common/ShareButton";

// —— JSON 工具：最小化 & 精簡（去私密路徑、移除 base64 影像）——
function minifyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text || "";
  }
}

function sanitizeComfyWorkflow(text) {
  try {
    const obj = JSON.parse(text);
    const prune = (v) => {
      if (typeof v === "string") {
        // 去除內嵌影像（base64）
        if (/^data:image\/(png|jpe?g|webp);base64,/i.test(v)) return "[data:image]";
        // 去除本機/雜湊路徑，只留檔名
        if (/[\\/][^\\/]+\.(?:ckpt|safetensors|png|jpe?g|webp|gif|mp4|mov)$/i.test(v)) {
          const parts = v.split(/[\/\\]/);
          return parts[parts.length - 1];
        }
        return v;
      }
      if (Array.isArray(v)) return v.map(prune);
      if (v && typeof v === "object") {
        const out = {};
        for (const k in v) out[k] = prune(v[k]);
        return out;
      }
      return v;
    };
    return JSON.stringify(prune(obj));
  } catch {
    // 不是有效 JSON 就至少做最小化
    return minifyJson(text);
  }
}

import PowerCouponButton from "@/components/power-coupon/PowerCouponButton";
import { getPlatformUrl } from "@/constants/platformUrls";

export default function ImageInfoBox({ image, currentUser, displayMode = "gallery", onClose, onEdit, onPowerCouponSuccess }) {
  const positiveRef = useRef();
  const negativeRef = useRef();
  const paramsRef = useRef();
  const [copiedField, setCopiedField] = useState(null);
  const [copyTip, setCopyTip] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false); // ✅ 畫廊模式下控制秘密展開
  const router = useRouter();
  
  // ✅ 手機檢測
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // —— 1 秒冷卻（前端）——
  const [cooling, setCooling] = useState({}); // 例如 { "copy.workflow": true }
  const cooldownMs = 1000;
  function startCooldown(key, ms = cooldownMs) {
    setCooling((s) => ({ ...s, [key]: true }));
    setTimeout(() => setCooling((s) => ({ ...s, [key]: false })), ms);
  }
  function withCooldown(key, fn, ms = cooldownMs) {
    return (...args) => {
      if (cooling[key]) return; // 冷卻期間直接無效，不顯示任何提示
      startCooldown(key, ms);
      fn?.(...args);
    };
  }
  // 小工具：判斷像網址的字串
  const looksUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s?.trim());
  // 多筆切分（支援換行、半形/全形逗號、頓號）
  const splitList = (s) =>
    String(s || "")
      .split(/\r?\n|,|、|，/g)
      .map((x) => x.trim())
      .filter(Boolean);

  // 從 prompt 裡抓真正出現過的 <lora:NAME:...> 名稱清單
  const extractLoraNamesFromPrompt = (txt) => {
    if (!txt) return [];
    const out = [];
    const re = /<\s*lora\s*:\s*([^:>]+)\s*:/gi;
    let m;
    while ((m = re.exec(String(txt))) !== null) {
      out.push(m[1].trim());
    }
    return Array.from(new Set(out));
  };

  // 盡量從 image 物件裡收集「可能的正面 prompt」欄位
  const getPositivePrompt = (image) =>
    image?.positivePrompt ||
    image?.prompt ||
    image?.promptPositive ||
    image?.meta?.positive ||
    "";

  // === 檢舉彈窗狀態 ===
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("category_wrong");
  const [reportMsg, setReportMsg] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  // === 追蹤狀態（樂觀 + 同步 UserHeader 的 follow-changed 事件） ===
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(!!image?.user?.isFollowing);

  // 切換圖片或 props 更新時同步 isFollowing
  useEffect(() => {
    setIsFollowing(!!image?.user?.isFollowing);
  }, [image?.user?.isFollowing, image?.user?._id]);

  // 監聽來自其他元件（如 UserHeader）的狀態變更
  useEffect(() => {
    const onChanged = (e) => {
      const { targetUserId, isFollowing: next } = e.detail || {};
      if (String(targetUserId) === String(image?.user?._id)) {
        setIsFollowing(!!next);
      }
    };
    window.addEventListener("follow-changed", onChanged);
    return () => window.removeEventListener("follow-changed", onChanged);
  }, [image?.user?._id]);

  // 點擊追蹤/取消：樂觀更新 + 呼叫 API + 廣播同步
  const handleFollowToggle = async () => {
    if (!currentUser || !image?.user?._id || followLoading) return;
    const willFollow = !isFollowing;
    setIsFollowing(willFollow); // 樂觀
    setFollowLoading(true);
    try {
      if (willFollow) {
        await axios.post(
          "/api/follow",
          { userIdToFollow: image.user._id },
          { withCredentials: true }
        );
      } else {
        await axios.delete("/api/follow", {
          data: { userIdToUnfollow: image.user._id },
          withCredentials: true,
        });
      }
      window.dispatchEvent(
        new CustomEvent("follow-changed", {
          detail: { targetUserId: String(image.user._id), isFollowing: willFollow },
        })
      );
    } catch (err) {
      setIsFollowing((prev) => !prev); // 失敗回滾
      notify.error("錯誤", err?.response?.data?.message || err?.message || "追蹤操作失敗");
    } finally {
      setFollowLoading(false);
    }
  };

  const reportOptions = [
    { value: "category_wrong", label: "分類錯誤" },
    { value: "rating_wrong", label: "分級錯誤" },
    { value: "duplicate", label: "重複/洗版" },
    { value: "broken", label: "壞圖/無法顯示" },
    { value: "policy_violation", label: "站規違規" },
    { value: "other", label: "其他（需說明）" },
  ];

  const handleReportSubmit = async () => {
    if (!image?._id) return;
    if (currentUser && String(currentUser._id) === String(image.user?._id)) {
      notify.warning("提示", "不能檢舉自己的作品");
      return;
    }
    if (reportType === "other" && !reportMsg.trim()) {
      notify.warning("提示", "請填寫說明");
      return;
    }
    setReportLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ imageId: image._id, type: reportType, message: reportMsg }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      notify.success("成功", "已收到你的檢舉，感謝協助！");
      setShowReport(false);
      setReportType("category_wrong");
      setReportMsg("");
    } catch (e) {
      notify.error("提交失敗", e.message || "請稍後再試");
    } finally {
      setReportLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await notify.confirm("確認刪除", "你確定要刪除這張圖片嗎？");
    if (!confirmed) return;

    if (!image || !image._id) {
      notify.error("錯誤", "找不到圖片資訊，無法刪除！");
      return;
    }

    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ id: String(image._id) }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        // 將成功狀態保存到 sessionStorage，刷新後顯示提示
        if (typeof window !== "undefined") {
          sessionStorage.setItem("imageDeletedSuccess", JSON.stringify({
            title: "成功",
            message: "圖片刪除成功！"
          }));
        }
        onClose?.();
        window.scrollTo(0, 0);
        setTimeout(() => window.location.reload(), 50);
      } else {
        console.warn("刪除回應：", data);
        notify.error("刪除失敗", data?.error || res.statusText || "請稍後再試");
      }
    } catch (err) {
      console.error("❌ 刪除圖片失敗", err);
      notify.error("刪除失敗", "請稍後再試。");
    }
  };

  const copyText = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const copyFromRef = (ref, field) => {
    if (ref.current) copyText(ref.current.innerText, field);
  };

  // ✅ 共用複製：先寫入剪貼簿；失敗則下載備援
  async function copyJson(kindLabel, text, fallbackFilename = "data.json") {
    if (!text) return;
    const finalText = minifyJson(text);
    try {
      await navigator.clipboard.writeText(finalText);
      setCopyTip(`${kindLabel} 已複製`);
    } catch {
      try {
        const blob = new Blob([finalText], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fallbackFilename;
        a.click();
        URL.revokeObjectURL(url);
        setCopyTip(`已下載 ${fallbackFilename}`);
      } catch {
        setCopyTip("複製失敗");
      }
    } finally {
      setTimeout(() => setCopyTip(""), 1500);
    }
  }

  const getRatingLabel = (rating) => {
    switch (rating) {
      case "18":
        return <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">18+</span>;
      case "15":
        return <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">15+</span>;
      default:
        return <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">一般</span>;
    }
  };

  // 計算元數據質量
  const getMetadataQuality = (image) => {
    if (!image) return "普通图";
    
    // 檢查是否為AI生成圖（有模型或LoRA）
    const hasModel = image.modelName && image.modelName.trim() !== "(未提供)";
    const hasLora = image.loraName && image.loraName.trim() !== "(未提供)";
    const hasPrompt = image.positivePrompt && image.positivePrompt.trim() !== "(無)";
    
    // 如果不是AI生成圖，返回普通图
    if (!hasModel && !hasLora && !hasPrompt) return "普通图";
    
    // 檢查自動抓取的參數
    let autoCount = 0;
    let totalCount = 0;
    
    // 檢查各項參數（排除空值）
    const params = [
      'modelName', 'loraName', 'positivePrompt', 'negativePrompt',
      'steps', 'sampler', 'cfgScale', 'seed', 'width', 'height'
    ];
    
    params.forEach(param => {
      const value = image[param];
      // 確保 value 是字符串且不為空
      if (value && typeof value === 'string' && value.trim() && value.trim() !== "(未提供)" && value.trim() !== "(無)") {
        totalCount++;
        // 這裡需要根據實際的來源標記來判斷是否為自動抓取
        // 暫時用簡單的邏輯：如果有值就認為是自動抓取
        autoCount++;
      } else if (value && typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        // 處理數字類型（如 steps, cfgScale, width, height）
        totalCount++;
        autoCount++;
      }
    });
    
    if (totalCount === 0) return "普通图";
    
    const autoRatio = autoCount / totalCount;
    
    // 特殊情況：LoRA沒抓到（空值），其他都自動抓取 = 優質圖
    const loraEmpty = !image.loraName || image.loraName.trim() === "" || image.loraName.trim() === "(未提供)";
    const otherParamsCount = totalCount - (hasLora ? 1 : 0); // 排除LoRA的其他參數數量
    const otherAutoCount = autoCount - (hasLora ? 1 : 0); // 排除LoRA的其他自動抓取數量
    
    if (loraEmpty && otherParamsCount > 0 && otherAutoCount === otherParamsCount) {
      return "优质图";
    }
    
    // 特殊情況：只有LoRA手動填寫，其他都自動抓取 = 標準圖
    const loraManual = hasLora && !loraEmpty;
    if (loraManual && otherParamsCount > 0 && otherAutoCount === otherParamsCount) {
      return "标准图";
    }
    
    if (autoRatio >= 0.8) return "优质图";
    if (autoRatio >= 0.5) return "标准图";
    return "普通图";
  };

  // 獲取質量標識圖標
  const getQualityIcon = (quality) => {
    switch (quality) {
      case "优质图":
        return <span className="text-yellow-400">⭐</span>;
      case "标准图":
        return <span className="text-green-400">✓</span>;
      default:
        return null;
    }
  };

  // ======= 生成參數彙整 =======
  const adv = useMemo(
    () => ({
      model: image.modelName?.trim(),
      lora: image.loraName?.trim(),
      steps: image.steps,
      sampler: image.sampler,
      cfgScale: image.cfgScale ?? image.cfg, // ← 兼容 ComfyUI 的 cfg
      seed: image.seed,
      clipSkip: image.clipSkip,
      width: image.width,
      height: image.height,
      modelHash: image.modelHash,
    }),
    [image]
  );

  const hasAdvanced = useMemo(
    () =>
      Object.values(adv).some(
        (v) => v !== undefined && v !== null && String(v).toString().trim() !== ""
      ),
    [adv]
  );

  const buildA1111ParameterString = () => {
    const parts = [];
    if (image.positivePrompt) parts.push(image.positivePrompt);
    if (image.negativePrompt) parts.push(`Negative prompt: ${image.negativePrompt}`);
    const kv = [];
    if (adv.steps) kv.push(`Steps: ${adv.steps}`);
    if (adv.sampler) kv.push(`Sampler: ${adv.sampler}`);
    if (adv.cfgScale) kv.push(`CFG scale: ${adv.cfgScale}`);
    if (adv.seed) kv.push(`Seed: ${adv.seed}`);
    if (adv.width && adv.height) kv.push(`Size: ${adv.width}x${adv.height}`);
    if (adv.clipSkip) kv.push(`Clip skip: ${adv.clipSkip}`);
    if (adv.model) kv.push(`Model: ${adv.model}`);
    if (adv.modelHash) kv.push(`Model hash: ${adv.modelHash}`);
    if (adv.lora) kv.push(`LoRA: ${adv.lora}`);
    parts.push(kv.join(", "));
    return parts.filter(Boolean).join("\n");
  };

  const paramsString = buildA1111ParameterString();

  // === ComfyUI 原始 JSON（作品詳情頁顯示用） ===
  const comfyObj = image?.comfy || image?.raw?.comfy || null;
  const comfyWorkflowJSON =
    (typeof comfyObj?.workflowRaw === "string" && comfyObj.workflowRaw.trim()) ||
    (typeof image?.raw?.comfyWorkflowJson === "string" && image.raw.comfyWorkflowJson.trim()) ||
    "";

  const comfyPromptJSON =
    (typeof comfyObj?.promptRaw === "string" && comfyObj.promptRaw.trim()) ||
    "";

  // 是否為作者：支持多種格式（image.user 可能是對象或字符串）
  const imageOwnerId = 
    (typeof image.user === 'object' && image.user !== null) 
      ? (image.user._id || image.user.id || image.user.userId)
      : (image.user || image.userId);
  const currentUserId = currentUser?._id || currentUser?.id;
  const isOwner = !!currentUser && imageOwnerId && currentUserId && String(currentUserId) === String(imageOwnerId);
  
  // 是否作者或管理員
  const isOwnerOrAdmin = isOwner || currentUser?.isAdmin;

  // 從後端帶回的公開狀態（相容舊命名 allowComfyShare）
  const allowShare = (image?.comfy?.allowShare ?? image?.allowComfyShare ?? true);

  // 只有在 (ComfyUI + 有 workflow + (允許公開 或 自己/管理員)) 時才顯示卡片
  const canSeeComfyJson =
    image.platform === "ComfyUI" &&
   (comfyWorkflowJSON || comfyPromptJSON) &&
    allowShare;

  return (
    <div className="relative w-full overflow-x-hidden break-words space-y-4">
      {/* 標題與工具列 */}
      <div className="space-y-3 mb-3">
        {/* 按鈕工具列 */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* 分享按鈕 */}
          {image?._id && (
            <ShareButton
              url={`${process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "")}/images/${image._id}`}
              title={image.title || "AI 圖像創作"}
              variant="default"
            />
          )}

          {/* 引用發帖 */}
          <button
            onClick={() => {
              const imageId = image?._id || image?.id;
              if (imageId) {
                router.push(`/discussion/create?imageRef=${imageId}`);
              }
            }}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 
                       hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium rounded
                       shadow-lg hover:shadow-xl transition-all active:scale-95"
            title="引用此圖片發帖討論"
          >
            <MessageSquare size={16} />
            <span>引用發帖</span>
          </button>

          {/* 編輯放在下載左邊；僅作者或管理員可見 */}
          {isOwnerOrAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded shadow transition"
                title="編輯圖片資料"
              >
                <Pencil size={16} />
                <span>編輯</span>
              </button>
            )}

          {/* 加成券使用按鈕；僅作者可見 */}
          {isOwner && (
              <div onClick={(e) => e.stopPropagation()}>
                <PowerCouponButton
                  contentType="image"
                  contentId={image._id}
                  contentTitle={image.title || "圖片"}
                  onSuccess={onPowerCouponSuccess}
                />
              </div>
            )}

          {/* 刪除（作者/管理員） */}
          {isOwnerOrAdmin && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded shadow transition"
                title="刪除圖片"
              >
                <Trash2 size={16} />
              </button>
            )}

          {/* 檢舉（登入且不是作者才顯示） */}
          {currentUser && !isOwner && (
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded shadow transition"
              title="檢舉圖片"
            >
              <AlertTriangle size={16} />
            </button>
          )}

          {/* 關閉 */}
          <button onClick={onClose} className="text-white hover:text-red-400 transition" title="關閉視窗">
            <X size={20} />
          </button>
        </div>

        {/* 標題 */}
        <div className="text-xl font-bold leading-tight text-white">
          {image.title || "（無標題）"}
        </div>
      </div>

      {/* 檢舉彈窗 */}
      {showReport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-4 rounded-lg w-full max-w-md text-white space-y-3">
            <div className="text-lg font-semibold">檢舉圖片</div>
            <select
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {reportOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <textarea
              className="w-full p-2 rounded bg-zinc-800 border border-zinc-700"
              rows={4}
              placeholder={reportType === "other" ? "請輸入檢舉說明…" : "（可選）補充說明"}
              value={reportMsg}
              onChange={(e) => setReportMsg(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="px-3 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
                disabled={reportLoading}
              >
                取消
              </button>
              <button
                onClick={handleReportSubmit}
                className="px-3 py-1 bg-rose-600 rounded hover:bg-rose-500"
                disabled={reportLoading}
              >
                {reportLoading ? "送出中…" : "送出檢舉"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分級 */}
      <div className="mb-3 flex items-center gap-2">
        {getRatingLabel(image.rating)}
        {getQualityIcon(getMetadataQuality(image))}
      </div>

      {/* ✅ 作品展示模式：如果圖片有學習價值的元數據，顯示「揭開秘密」按鈕（手機版隱藏） */}
      {displayMode === "gallery" && !isMobile && (getMetadataQuality(image) === "优质图" || getMetadataQuality(image) === "标准图") && (
        <button
          onClick={() => setShowSecrets(!showSecrets)}
          className="relative w-full mb-4 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-100"
        >
          <span className="flex items-center justify-center gap-2">
            {showSecrets ? (
              <>🔒 隱藏創作秘密</>
            ) : (
              <>
                🔓 揭開創作秘密
                <span className="text-xs font-normal opacity-75">（查看完整生成參數）</span>
              </>
            )}
          </span>
          {/* 閃爍提示 */}
          {!showSecrets && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
            </span>
          )}
        </button>
      )}

      {/* ✅ 秘密揭開提示（作品展示模式） */}
      {displayMode === "gallery" && showSecrets && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-2 border-purple-500 rounded-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold mb-1">
            ✨ 創作秘密已解鎖 ✨
          </div>
          <p className="text-xs text-gray-400">
            以下參數可以幫助你重現類似的作品效果
          </p>
        </div>
      )}

      {/* ✅ 技術參數區塊：創作參考模式直接顯示，作品展示模式需要點「揭開秘密」 */}
      {(displayMode === "collection" || (displayMode === "gallery" && showSecrets)) && (
        <>
          <div className="text-sm text-zinc-300 mb-3">
            來源作者： <span className="text-white">{image?.author?.trim() || "—"}</span>
          </div>
          <div className="text-sm text-gray-300 mb-3">
            平台：{(() => {
              const platform = image.platform?.trim();
              if (!platform) return "未指定";
              
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
              
              return <span className="text-white">{platform}</span>;
            })()}
          </div>

          {/* ComfyUI：原始 JSON 下載（顯示在資訊欄） */}
          {canSeeComfyJson && (
        <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-600/20 text-emerald-300 px-2 py-0.5 text-xs">
                ComfyUI
              </span>
              <span className="text-sm text-zinc-300">
                提供原始 {comfyWorkflowJSON ? "workflow" : "prompt"} 下載以便復現
              </span>
            </div>

            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(
                comfyWorkflowJSON || comfyPromptJSON
              )}`}
              download={`${comfyWorkflowJSON ? "workflow" : "prompt"}_${image?._id || "image"}.json`}
              className={`flex items-center gap-1 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm ${cooling["download.json"] ? "opacity-60 pointer-events-none" : ""}`}
              onClick={(e) => { if (cooling["download.json"]) { e.preventDefault(); return; } startCooldown("download.json"); }}
              aria-disabled={!!cooling["download.json"]}
              title="下載 ComfyUI JSON"
            >
              <Download size={16} />
              下載 {comfyWorkflowJSON ? "workflow.json" : "prompt.json"}
            </a>
          </div>

          {/* 🔹 新增：複製 JSON / 精簡版 */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={withCooldown("copy.workflow", () =>
                copyJson("workflow.json", comfyWorkflowJSON, "workflow.json")
              )}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-60 disabled:pointer-events-none"
              disabled={!comfyWorkflowJSON || !!cooling["copy.workflow"]}
              title="複製到剪貼簿（失敗時自動下載）"
            >
              複製 workflow.json
            </button>

            <button
              onClick={withCooldown("copy.prompt", () =>
                copyJson("prompt.json", comfyPromptJSON, "prompt.json")
              )}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs disabled:opacity-60 disabled:pointer-events-none"
              disabled={!comfyPromptJSON || !!cooling["copy.prompt"]}
              title="複製到剪貼簿（失敗時自動下載）"
            >
              複製 prompt.json
            </button>

            <button
              onClick={withCooldown("copy.slim", () =>
                copyJson(
                  "精簡 workflow.json",
                  sanitizeComfyWorkflow(comfyWorkflowJSON),
                  "workflow_slim.json"
                )
              )}
              className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs disabled:opacity-60 disabled:pointer-events-none"
              disabled={!comfyWorkflowJSON || !!cooling["copy.slim"]}
              title="去除私密路徑與內嵌影像後再複製（公開分享更安全）"
            >
              複製精簡 workflow.json
            </button>

            {copyTip && <span className="text-xs text-emerald-400">{copyTip}</span>}
          </div>

          <details className="mt-2 group">
            <summary className="cursor-pointer text-xs text-zinc-400 group-open:text-zinc-300">
              預覽 JSON（展開）
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap break-words bg-black/30 p-2 rounded">
{(comfyWorkflowJSON || comfyPromptJSON).slice(0, 4000)}
{(comfyWorkflowJSON || comfyPromptJSON).length > 4000 ? "\n...（已截斷顯示）" : ""}
            </pre>
          </details>
        </div>
      )}

      {/* 模型 / LoRA */}
      <div className="text-sm text-gray-300 mb-3">
        模型名稱：<br />
        {(() => {
          const ref = image?.modelRef;
          const name = (ref?.modelName || image?.modelName || "").trim();
          const url = (ref?.modelLink || image?.modelLink || "").trim();

          if (!name && !looksUrl(url)) return <span className="text-white">(未提供)</span>;
          if (looksUrl(url)) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline break-words inline-block max-w-[260px]"
                title={ref?.modelType ? `類型：${ref.modelType}` : undefined}
              >
                {name || url}
              </a>
            );
          }
          return <span className="text-white break-words inline-block max-w-[260px]">{name}</span>;
        })()}
      </div>

      <div className="text-sm text-gray-300 mb-3">
        LoRA 名稱：<br />
        {Array.isArray(image?.loraRefs) && image.loraRefs.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {image.loraRefs.map((lr) => {
              const nm = (lr?.name || lr?.hash || "").trim();
              const url = (lr?.modelLink || lr?.versionLink || "").trim();
              return (
                <li key={lr?.hash || nm} className="leading-snug">
                  {looksUrl(url) ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline break-words inline-block max-w-[260px]"
                    >
                      {nm}
                    </a>
                  ) : (
                    <span className="text-white break-words inline-block max-w-[260px]">{nm}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (() => {
          const rawNames = splitList(image?.loraName);
          const rawLinks = splitList(image?.loraLink).filter(looksUrl);

          const comfyLoraNames = Array.isArray(image?.loras)
            ? image.loras.map((x) => (x?.name || "").trim()).filter(Boolean)
            : [];

          const pp = getPositivePrompt(image);
          const validFromPrompt = new Set(extractLoraNamesFromPrompt(pp).map((s) => s.toLowerCase()));

          let names = (rawNames.length ? rawNames : comfyLoraNames)
            .filter((n) => n && !/[{}]/.test(n) && !/\|/.test(n))
            .filter((n) => validFromPrompt.size === 0 || validFromPrompt.has(n.toLowerCase()));

          if (rawLinks.length === 1 && names.length > 1) {
            names = [
              names.find((n) => rawLinks[0].toLowerCase().includes(n.toLowerCase())) || names[0],
            ];
          }
          if (rawLinks.length > 0 && names.length > rawLinks.length) {
            names = names.slice(0, rawLinks.length);
          }

          if (names.length === 0 && rawLinks.length === 0) {
            return <span className="text-white">(未提供)</span>;
          }

          return (
            <ul className="mt-1 space-y-1">
              {(names.length ? names : rawLinks).map((_, idx) => {
                const name = (names[idx] || "").trim();
                const link = (rawLinks[idx] || "").trim();
                const showText = name || link;
                return looksUrl(link) ? (
                  <li key={`${showText}-${idx}`} className="leading-snug">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline break-words inline-block max-w-[260px]"
                    >
                      {showText}
                    </a>
                  </li>
                ) : (
                  <li key={`${showText}-${idx}`} className="leading-snug">
                    <span className="text-white break-words inline-block max-w-[260px]">
                      {showText || "（未提供）"}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </div>

          {/* 正面 / 負面提示詞 */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <strong className="text-sm text-white">正面提示詞：</strong>
              <button
                onClick={() => copyFromRef(positiveRef, "positive")}
                className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                {copiedField === "positive" ? "✔ 已複製" : "複製"}
              </button>
            </div>
            <div
              ref={positiveRef}
              className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
            >
              {image.positivePrompt || "（無）"}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <strong className="text-sm text-white">負面提示詞：</strong>
              <button
                onClick={() => copyFromRef(negativeRef, "negative")}
                className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                {copiedField === "negative" ? "✔ 已複製" : "複製"}
              </button>
            </div>
            <div
              ref={negativeRef}
              className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
            >
              {image.negativePrompt || "（無）"}
            </div>
          </div>

          {/* 進階參數 */}
          <div className="rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full text-left px-4 py-2 font-semibold bg-zinc-800 hover:bg-zinc-700 transition"
            >
              {showAdvanced ? "▼" : "►"} 生成參數（可展開）
            </button>
            {showAdvanced && (
              <div className="p-4 space-y-3 bg-zinc-900/60">
                {hasAdvanced ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <Field label="Steps" value={adv.steps} />
                      <Field label="Sampler" value={adv.sampler} />
                      <Field label="CFG scale" value={adv.cfgScale} />
                      <Field label="Seed" value={adv.seed} />
                      <Field label="Clip skip" value={adv.clipSkip} />
                      <Field label="寬度" value={adv.width} />
                      <Field label="高度" value={adv.height} />
                      <Field label="Model hash" value={adv.modelHash} />
                      <Field
                        label="LoRA hashes"
                        value={
                          Array.isArray(image?.loraRefs) && image.loraRefs.length > 0
                            ? image.loraRefs.map((x) => x?.hash).filter(Boolean).join(", ")
                            : Array.isArray(image?.loraHashes) && image.loraHashes.length > 0
                            ? image.loraHashes.join(", ")
                            : "—"
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div ref={paramsRef} className="sr-only">
                        {paramsString}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(paramsString, "params")}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Clipboard size={14} />
                        {copiedField === "params" ? "✔ 已複製參數" : "複製成 A1111 格式"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400">（沒有儲存到生成參數）</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 分類 - 兩種模式都顯示 */}
      {/* 分類 */}
      {(() => {
        // 優先使用 categories 數組，如果沒有則使用 category 單個值
        const categoriesToShow = Array.isArray(image.categories) && image.categories.length > 0
          ? image.categories
          : image.category
            ? [image.category]
            : [];

        if (categoriesToShow.length === 0) return null;

        return (
          <div className="text-sm text-gray-300 mb-3">
            分類：{categoriesToShow.join("、")}
          </div>
        );
      })()}

      {/* 標籤 - 兩種模式都顯示 */}
      <div className="text-sm text-gray-300 mb-3">
        標籤：
        {Array.isArray(image.tags) && image.tags.length > 0
          ? image.tags.map((tag, index) => (
              <button
                key={index}
                onClick={() => {
                  const keyword = tag;
                  // ✅ 跳轉到圖片專區的搜尋頁面
                  router.push(`/images?search=${encodeURIComponent(keyword)}`);
                  onClose?.();
                }}
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-xs px-2 py-1 rounded mr-1 mb-1 transition"
              >
                #{tag}
              </button>
            ))
          : "（無標籤）"}
      </div>

      {/* 描述 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-base text-white">描述：</strong>
        </div>
        <div className="bg-neutral-900 border border-white/20 text-gray-200 text-base p-3 rounded-lg whitespace-pre-wrap break-words">
          {image.description || "（無）"}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded p-2">
      <div className="text-zinc-400 mb-1">{label}</div>
      <div className="text-white break-words min-h-[18px]">{value ?? "—"}</div>
    </div>
  );
}

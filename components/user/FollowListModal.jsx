"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import Modal from "../common/Modal";
import AvatarFrame from "../common/AvatarFrame";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";

// 產生 Cloudflare Images 變體 URL（統一用 avatar 變體，載入較快）
const cf = (id) => `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${id}/avatar`;

// 兼容不同資料形狀
const getUserObj = (row) => row?.user || row?.userId || row || {};

// 依性別挑預設
const pickDefaultAvatarId = (u) => {
  const g = String(u?.gender ?? u?.sex ?? "").toLowerCase();
  if (g === "male" || g === "m" || g === "boy" || g === "男") return DEFAULT_AVATAR_IDS.male;
  if (g === "female" || g === "f" || g === "girl" || g === "女") return DEFAULT_AVATAR_IDS.female;
  return DEFAULT_AVATAR_IDS.hidden; // 未公開/未填
};

// 內建最後防線：灰色 SVG 頭像（不會 404）
const INLINE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
       <circle cx='40' cy='28' r='16' fill='#9CA3AF'/>
       <rect x='12' y='50' width='56' height='22' rx='11' fill='#9CA3AF'/>
     </svg>`
  );

// Avatar：固定灰底 + blur 佔位 + 三段回退（自訂 → 性別預設 → hidden → SVG）
function AvatarImg({ userLike, size = 40, className = "" }) {
  const u = useMemo(() => getUserObj(userLike), [userLike]);

  const initialSrc = useMemo(() => {
    const id = (typeof u.image === "string" && u.image.trim()) || pickDefaultAvatarId(u);
    return cf(id);
  }, [u]);

  const [src, setSrc] = useState(initialSrc);
  const [tries, setTries] = useState(0);

  // user 變動 → 重置
  useEffect(() => {
    setSrc(initialSrc);
    setTries(0);
  }, [initialSrc]);

  const handleError = () => {
    if (tries === 0) {
      setTries(1);
      setSrc(cf(pickDefaultAvatarId(u)));  // 性別預設（保險再試一次）
      return;
    }
    if (tries === 1) {
      setTries(2);
      setSrc(cf(DEFAULT_AVATAR_IDS.hidden)); // 最終 Cloudflare 圖檔 fallback
      return;
    }
    setSrc(INLINE_SVG); // 內建 SVG，絕不黑
  };

  return (
    <span
      className={`relative inline-block rounded-full overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        // ✅ 第一幀就給灰底，避免任何黑閃
        backgroundColor: "rgba(156,163,175,0.25)",
      }}
    >
      <Image
        src={src}
        alt="頭像"
        width={size}
        height={size}
        // ✅ Next.js 內建 blur 佔位，避免空幀
        placeholder="blur"
        blurDataURL={INLINE_SVG}
        // 漸入更順眼
        style={{ width: size, height: size, objectFit: "cover" }}
        onError={handleError}
      />
    </span>
  );
}

export default function FollowListModal({ isOpen, onClose, currentUser }) {
  const [followedUsers, setFollowedUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingNote, setEditingNote] = useState("");

  useEffect(() => {
    if (!isOpen || !currentUser?._id) return;

    const fetchFollowedUsers = async () => {
      try {
        const res = await fetch("/api/follow");
        const data = await res.json();
        setFollowedUsers(Array.isArray(data.following) ? data.following : []);
      } catch (err) {
        console.error("載入追蹤清單失敗：", err);
        setFollowedUsers([]);
      }
    };

    fetchFollowedUsers();
  }, [isOpen, currentUser]);

  const handleEdit = (userId, currentNote) => {
    setEditingId(userId);
    setEditingNote(currentNote || "");
  };

  const handleSave = async (userId) => {
    try {
      const res = await fetch("/api/follow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdToUpdate: userId, newNote: editingNote }),
      });

      if (!res.ok) throw new Error("更新失敗");

      setFollowedUsers((prev) =>
        prev.map((row) => {
          const u = getUserObj(row);
          const id = u?._id || row?._id;
          return String(id) === String(userId)
            ? { ...row, note: editingNote, user: { ...u, note: editingNote } }
            : row;
        })
      );

      setEditingId(null);
      setEditingNote("");
    } catch (err) {
      console.error("儲存備註失敗：", err);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-white max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">已追蹤的用戶</h2>

        {followedUsers.length === 0 ? (
          <p className="text-gray-400">尚未追蹤任何人</p>
        ) : (
          <ul className="space-y-3">
            {followedUsers.map((raw) => {
              const u = getUserObj(raw);
              const userId = u?._id || raw?._id;
              const username = u?.username || raw?.username || "未命名用戶";
              const note = u?.note ?? raw?.note ?? "";
              const isEditing = String(editingId) === String(userId);
              

              return (
                <li key={String(userId)}>
                  <div className="flex items-start justify-between hover:bg-zinc-800 p-2 rounded-lg">
                    <Link
                      href={`/user/${userId}`}
                      className="flex items-center space-x-3"
                      onClick={onClose}
                    >
                      {/* ✅ 使用 AvatarFrame 顯示頭像框 */}
                      <AvatarFrame
                        src={cf(u.image || pickDefaultAvatarId(u))}
                        size={48}
                        frameId={u.currentFrame || "default"}
                        showFrame={!!u.currentFrame && u.currentFrame !== "default"}
                        frameColor={u.frameSettings?.color || undefined}
                        frameOpacity={u.frameSettings?.opacity !== undefined ? u.frameSettings.opacity : 1}
                        layerOrder={u.frameSettings?.layerOrder || "frame-on-top"}
                        frameTransparency={u.frameSettings?.transparency !== undefined ? u.frameSettings.transparency : 1}
                        ring={true}
                      />

                      <div className="flex flex-col">
                        <span className="text-lg">{username}</span>
                        {note && !isEditing && (
                          <span className="text-sm text-zinc-400">（{note}）</span>
                        )}
                      </div>
                    </Link>

                    <div className="ml-4">
                      {isEditing ? (
                        <div className="flex flex-col space-y-1">
                          <input
                            type="text"
                            value={editingNote}
                            onChange={(e) => setEditingNote(e.target.value)}
                            className="text-sm text-white bg-zinc-700 placeholder-gray-400 px-2 py-1 rounded"
                            placeholder="輸入備註"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSave(userId)}
                              className="text-green-400 hover:underline text-sm"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-red-400 hover:underline text-sm"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(userId, note)}
                          className="text-sm text-blue-400 hover:underline"
                        >
                          ✏️ 編輯備註
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

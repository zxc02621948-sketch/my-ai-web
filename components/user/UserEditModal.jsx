// components/user/UserEditModal.jsx
"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Modal from "@/components/common/Modal";
import { notify } from "@/components/common/GlobalNotificationManager";
import { getApiErrorMessage, isAuthError } from "@/lib/clientAuthError";

const UserEditModal = ({ isOpen, onClose, currentUser, onUpdate }) => {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [backupEmail, setBackupEmail] = useState("");

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || "");
      setBio(currentUser.bio || "");
      setEmail(currentUser.email || "");
      setBackupEmail(currentUser.backupEmail || "");
    }
  }, [currentUser]);

  const handleSubmit = async () => {
    try {
      const res = await axios.put("/api/edit-user", {
        username,
        bio,
        backupEmail, // ✅ 僅送出可變更的欄位
      });
      if (res.status === 200) {
        onUpdate?.(res.data);
        onClose();
        // 儲存成功後自動刷新頁面 - 使用更強制的刷新方法
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    } catch (err) {
      if (!isAuthError(err)) {
        console.error("更新失敗：", err);
      }
      notify.error("更新失敗", getApiErrorMessage(err, "更新失敗，請稍後再試"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="編輯個人資料">
      <div className="space-y-4">
        {/* 暱稱 */}
        <div>
          <label className="block text-sm font-medium mb-1">暱稱</label>
          <input
            type="text"
            className="w-full rounded border bg-black/30 p-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* 簡介 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            個人簡介（限 200 字）
          </label>
          <textarea
            className="w-full rounded border bg-black/30 p-2"
            rows={4}
            maxLength={200}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <div className="text-xs text-right text-gray-400">
            已輸入 {bio.length} / 200 字
          </div>
        </div>

        {/* 主信箱（只讀） */}
        <div>
          <label className="block text-sm font-medium mb-1">主信箱</label>
          <input
            type="email"
            className="w-full rounded border bg-black/30 p-2 text-gray-400 cursor-not-allowed"
            value={email}
            readOnly
          />
          <p className="text-xs text-gray-400 mt-1">
            ※ 主信箱無法在此更改，如需更換請使用「找回帳號」功能
          </p>
        </div>

        {/* 備用信箱（目前開放輸入，未驗證流程） */}
        <div>
          <label className="block text-sm font-medium mb-1">備用信箱</label>
          <input
            type="email"
            className="w-full rounded border bg-black/30 p-2"
            value={backupEmail}
            onChange={(e) => setBackupEmail(e.target.value)}
          />
          <p className="text-xs text-yellow-400 mt-1">
            ※ 備用信箱可用於找回帳號，未來會要求驗證
          </p>
        </div>

        {/* 提交 */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
          >
            儲存變更
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UserEditModal;

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Modal from "../common/Modal";

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
        setFollowedUsers(data.following || []);
      } catch (err) {
        console.error("載入追蹤清單失敗：", err);
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

      // 更新前端資料
      setFollowedUsers((prev) =>
        prev.map((user) =>
          user._id === userId ? { ...user, note: editingNote } : user
        )
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
            {followedUsers.map((user) => {
              const avatarUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${user.image}/public`;
              const isEditing = editingId === user._id;

              return (
                <li key={user._id}>
                  <div className="flex items-start justify-between hover:bg-zinc-800 p-2 rounded-lg">
                    <Link
                      href={`/user/${user._id}`}
                      className="flex items-center space-x-3"
                      onClick={onClose}
                    >
                      <img
                        src={avatarUrl}
                        alt="頭像"
                        width={40}
                        height={40}
                        className="rounded-full border border-gray-300 hover:opacity-80 object-cover"
                      />
                      <div className="flex flex-col">
                        <span className="text-lg">{user.username}</span>
                        {user.note && editingId !== user._id && (
                          <span className="text-sm text-zinc-400">
                            （{user.note}）
                          </span>
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
                              onClick={() => handleSave(user._id)}
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
                          onClick={() => handleEdit(user._id, user.note)}
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

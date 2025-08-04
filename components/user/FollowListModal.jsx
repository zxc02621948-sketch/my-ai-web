"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Modal from "../common/Modal";

export default function FollowListModal({ isOpen, onClose, currentUser }) {
  const [followedUsers, setFollowedUsers] = useState([]);

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

              return (
                <li key={user._id}>
                  <Link
                    href={`/user/${user._id}`}
                    className="flex items-center space-x-3 hover:bg-zinc-800 p-2 rounded-lg"
                    onClick={onClose}
                  >
                    <img
                      src={avatarUrl}
                      alt="頭像"
                      width={40}
                      height={40}
                      className="rounded-full border border-gray-300 hover:opacity-80 object-cover"
                    />
                    <span className="text-lg">{user.username}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

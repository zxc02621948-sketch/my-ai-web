"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Image from "next/image";

export default function FollowingPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get("/api/current-user");
        setCurrentUser(res.data);
      } catch {
        router.push("/"); // 未登入導回首頁
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUser?.following || currentUser.following.length === 0) return;

      try {
        const res = await axios.post("/api/get-following-users", {
          ids: currentUser.following,
        });

        // 把備註（note）合併到每個 user 裡
        const withNotes = res.data.map((user) => {
          const match = currentUser.following.find((f) =>
            typeof f === "object" && f.userId === user._id
          );
          return {
            ...user,
            note: match?.note || "",
          };
        });

        setFollowingUsers(withNotes);
      } catch (err) {
        console.error("取得追蹤清單失敗：", err);
      }
    };

    fetchFollowing();
  }, [currentUser]);

  const handleEditNote = (userId, currentNote) => {
    setEditingUserId(userId);
    setNoteInput(currentNote || "");
  };

  const handleSaveNote = async (userId) => {
    try {
      await axios.patch(
        "/api/follow/note",
        { targetUserId: userId, note: noteInput },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // 更新備註後重新整理
      setEditingUserId(null);
      setNoteInput("");
      location.reload(); // 或用 router.refresh() 如果你是 App Router
    } catch (err) {
      console.error("儲存備註失敗：", err);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">你追蹤的使用者</h1>

      {followingUsers.length === 0 ? (
        <p className="text-gray-400">你還沒有追蹤任何人喔～</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {followingUsers.map((user) => (
            <div
              key={user._id}
              className="text-center border border-zinc-700 p-3 rounded-lg bg-zinc-800"
            >
              <Image
                src={
                  user.avatar
                    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${user.avatar}/avatar`
                    : "/default-avatar.png"
                }
                alt={user.username}
                width={80}
                height={80}
                className="rounded-full mx-auto mb-2 object-cover border border-gray-400"
              />
              <p className="text-white text-sm mb-1">{user.username}</p>
              {editingUserId === user._id ? (
                <div className="space-y-1">
                  <input
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="w-full text-sm px-2 py-1 rounded bg-zinc-700 text-white border border-zinc-600"
                    maxLength={30}
                    placeholder="輸入備註"
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleSaveNote(user._id)}
                      className="text-green-400 text-sm hover:underline"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => setEditingUserId(null)}
                      className="text-gray-400 text-sm hover:underline"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-zinc-400 mb-1">
                    {user.note ? `（${user.note}）` : ""}
                  </p>
                  <button
                    onClick={() => handleEditNote(user._id, user.note)}
                    className="text-blue-400 text-sm hover:underline"
                  >
                    編輯備註
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

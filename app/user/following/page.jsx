// app/user/following/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Image from "next/image";

export default function FollowingPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [followingUsers, setFollowingUsers] = useState([]);
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
        setFollowingUsers(res.data);
      } catch (err) {
        console.error("取得追蹤清單失敗：", err);
      }
    };

    fetchFollowing();
  }, [currentUser]);

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
              className="cursor-pointer text-center"
              onClick={() => router.push(`/user/${user._id}`)}
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
              <p className="text-white text-sm">{user.username}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

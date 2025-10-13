"use client";

import { useState, useEffect } from "react";
import { getLevelInfo } from "@/utils/pointsLevels";

export default function LevelLeaderboard({ limit = 10 }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`/api/user/leaderboard?limit=${limit}`);
        const data = await response.json();
        
        if (data.success) {
          setLeaderboard(data.data || []);
        }
      } catch (error) {
        console.error("載入排行榜失敗:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-gray-200">等級排行榜</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-zinc-800 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-200">等級排行榜</h3>
      
      {leaderboard.length === 0 ? (
        <p className="text-gray-400 text-center py-4">暫無排行榜數據</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((user, index) => {
            const levelInfo = getLevelInfo(user.pointsBalance || 0);
            const rank = index + 1;
            
            return (
              <div 
                key={user._id} 
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  rank <= 3 
                    ? "bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 border-yellow-500/30" 
                    : "bg-zinc-800/50 border-zinc-700/50"
                }`}
              >
                {/* 排名 */}
                <div className="flex-shrink-0 w-8 text-center">
                  {rank <= 3 ? (
                    <span className="text-2xl">
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                    </span>
                  ) : (
                    <span className="text-gray-400 font-bold">#{rank}</span>
                  )}
                </div>

                {/* 頭像 */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                    {user.image ? (
                      <img 
                        src={user.image} 
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm font-semibold">
                        {user.username?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 用戶信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-200 truncate">
                      {user.username}
                    </span>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${levelInfo.color}`}>
                      {levelInfo.rank}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {levelInfo.title} • {user.pointsBalance || 0} 積分
                  </div>
                </div>

                {/* 積分 */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-lg font-bold text-yellow-400">
                    {user.pointsBalance || 0}
                  </div>
                  <div className="text-xs text-gray-500">積分</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

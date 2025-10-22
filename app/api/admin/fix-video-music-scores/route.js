import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import Music from '@/models/Music';
import { computeVideoCompleteness, computeVideoPopScore, computeVideoInitialBoostFromTop } from '@/utils/scoreVideo';
import { computeMusicCompleteness, computeMusicPopScore, computeMusicInitialBoostFromTop } from '@/utils/scoreMusic';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';

export async function POST(request) {
  try {
    // 驗證管理員權限
    const user = await getCurrentUserFromRequest(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    await dbConnect();

    const results = {
      videos: {
        total: 0,
        updated: 0,
        details: []
      },
      music: {
        total: 0,
        updated: 0,
        details: []
      }
    };

    // ===== 修復影片分數 =====
    const videos = await Video.find({}).lean();
    results.videos.total = videos.length;

    // 獲取當前最高分數
    const topVideo = await Video.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
    const topVideoScore = topVideo?.popScore || 0;

    for (const video of videos) {
      const oldData = {
        popScore: video.popScore || 0,
        initialBoost: video.initialBoost || 0,
        completeness: video.completenessScore || 0
      };

      // 重新計算完整度
      const newCompleteness = computeVideoCompleteness(video);

      // 重新計算初始加成
      const newInitialBoost = computeVideoInitialBoostFromTop(topVideoScore);

      // 更新影片對象以計算 popScore
      const updatedVideo = {
        ...video,
        completenessScore: newCompleteness,
        initialBoost: newInitialBoost
      };

      // 計算正確的 likesCount（從 likes 陣列）
      const correctLikesCount = Array.isArray(video.likes) ? video.likes.length : (video.likesCount || 0);
      
      // 使用正確的 likesCount 重新計算 popScore
      const videoWithCorrectLikes = {
        ...updatedVideo,
        likesCount: correctLikesCount
      };
      const newPopScore = computeVideoPopScore(videoWithCorrectLikes);

      // 更新資料庫
      await Video.updateOne(
        { _id: video._id },
        {
          $set: {
            completenessScore: newCompleteness,
            initialBoost: newInitialBoost,
            popScore: newPopScore,
            likesCount: correctLikesCount,  // ← 新增：同步 likesCount
            hasMetadata: newCompleteness > 50
          }
        }
      );

      results.videos.updated++;
      results.videos.details.push({
        title: video.title,
        old: oldData,
        new: {
          popScore: Math.round(newPopScore * 100) / 100,
          initialBoost: newInitialBoost,
          completeness: newCompleteness
        }
      });
    }

    // ===== 修復音樂分數 =====
    const music = await Music.find({}).lean();
    results.music.total = music.length;

    if (music.length > 0) {
      // 獲取當前最高分數
      const topMusic = await Music.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
      const topMusicScore = topMusic?.popScore || 0;

      for (const track of music) {
        const oldData = {
          popScore: track.popScore || 0,
          initialBoost: track.initialBoost || 0,
          completeness: track.completenessScore || 0
        };

        // 重新計算完整度
        const newCompleteness = computeMusicCompleteness(track);

        // 重新計算初始加成
        const newInitialBoost = computeMusicInitialBoostFromTop(topMusicScore);

        // 計算正確的 likesCount（從 likes 陣列）
        const correctLikesCount = Array.isArray(track.likes) ? track.likes.length : (track.likesCount || 0);

        // 更新音樂對象以計算 popScore
        const updatedMusic = {
          ...track,
          completenessScore: newCompleteness,
          initialBoost: newInitialBoost,
          likesCount: correctLikesCount
        };

        // 重新計算 popScore
        const newPopScore = computeMusicPopScore(updatedMusic);

        // 更新資料庫
        await Music.updateOne(
          { _id: track._id },
          {
            $set: {
              completenessScore: newCompleteness,
              initialBoost: newInitialBoost,
              popScore: newPopScore,
              likesCount: correctLikesCount,  // ← 新增：同步 likesCount
              hasMetadata: newCompleteness > 50
            }
          }
        );

        results.music.updated++;
        results.music.details.push({
          title: track.title,
          old: oldData,
          new: {
            popScore: Math.round(newPopScore * 100) / 100,
            initialBoost: newInitialBoost,
            completeness: newCompleteness
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${results.videos.updated} 個影片和 ${results.music.updated} 個音樂的分數`,
      results
    });

  } catch (error) {
    console.error('修復分數失敗:', error);
    return NextResponse.json({ 
      error: '修復分數失敗', 
      details: error.message 
    }, { status: 500 });
  }
}



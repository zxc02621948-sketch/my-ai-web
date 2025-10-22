import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Image from '@/models/Image';
import Comment from '@/models/Comment';
import { getCurrentUserFromRequest } from '@/lib/auth/getCurrentUserFromRequest';
import { computePopScore } from '@/utils/score';

export async function POST(request) {
  try {
    // 驗證管理員權限
    const user = await getCurrentUserFromRequest(request);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    await dbConnect();

    const results = {
      total: 0,
      updated: 0,
      withComments: 0,
      totalComments: 0,
      details: []
    };

    // 獲取所有圖片
    const images = await Image.find({}).lean();
    results.total = images.length;

    for (const image of images) {
      const oldCommentsCount = image.commentsCount || 0;
      const oldPopScore = image.popScore || 0;

      // 計算實際留言數（包括所有回覆）
      const actualCommentsCount = await Comment.countDocuments({ 
        imageId: image._id.toString() 
      });

      // 重新計算 popScore
      const imageWithComments = {
        ...image,
        commentsCount: actualCommentsCount
      };
      const newPopScore = computePopScore(imageWithComments);

      // 只有當數據有變化時才更新
      if (oldCommentsCount !== actualCommentsCount || Math.abs(oldPopScore - newPopScore) > 0.01) {
        await Image.updateOne(
          { _id: image._id },
          {
            $set: {
              commentsCount: actualCommentsCount,
              popScore: newPopScore
            }
          }
        );

        results.updated++;
        
        if (actualCommentsCount > 0) {
          results.withComments++;
          results.totalComments += actualCommentsCount;
        }

        results.details.push({
          title: image.title,
          old: {
            commentsCount: oldCommentsCount,
            popScore: Math.round(oldPopScore * 100) / 100
          },
          new: {
            commentsCount: actualCommentsCount,
            popScore: Math.round(newPopScore * 100) / 100
          },
          scoreIncrease: Math.round((newPopScore - oldPopScore) * 100) / 100
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${results.updated} 張圖片的留言數`,
      results: {
        total: results.total,
        updated: results.updated,
        withComments: results.withComments,
        totalComments: results.totalComments,
        avgCommentsPerImage: results.withComments > 0 
          ? Math.round((results.totalComments / results.withComments) * 10) / 10
          : 0,
        details: results.details
      }
    });

  } catch (error) {
    console.error('同步留言數失敗:', error);
    return NextResponse.json({ 
      error: '同步失敗', 
      details: error.message 
    }, { status: 500 });
  }
}



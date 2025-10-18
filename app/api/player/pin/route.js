import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import PointsTransaction from '@/models/PointsTransaction';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { targetUserId, targetUsername, playlist } = await request.json();

    if (!targetUserId || !playlist || playlist.length === 0) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
    }

    // ✅ 檢查用戶是否有釘選播放器訂閱
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

           // 檢查是否有釘選訂閱（包含試用和正式訂閱）
           const pinSubscription = user.subscriptions?.find(
             s => (s.type === 'pinPlayer' || s.type === 'pinPlayerTest') && s.isActive
           );

    if (!pinSubscription) {
      return NextResponse.json({ 
        error: '請先在積分商店開通「釘選播放器」訂閱功能',
        needSubscription: true
      }, { status: 403 });
    }

    // 檢查訂閱是否過期
    const now = new Date();
    // 兼容舊數據
    const subscriptionExpiresAt = pinSubscription.expiresAt 
      ? new Date(pinSubscription.expiresAt) 
      : (pinSubscription.nextBillingDate ? new Date(pinSubscription.nextBillingDate) : null);
    
    if (!subscriptionExpiresAt || subscriptionExpiresAt < now) {
      // 訂閱已過期，拒絕釘選
      return NextResponse.json({ 
        error: '訂閱已過期，請前往積分商店續費',
        needRenew: true
      }, { status: 403 });
    }

    // 設置釘選播放器
    const pinnedAt = new Date();
    const expiresAt = subscriptionExpiresAt; // 使用訂閱的到期時間

    const pinnedPlayerData = {
      userId: targetUserId,
      username: targetUsername,
      playlist: playlist,
      pinnedAt: pinnedAt,
      expiresAt: expiresAt,
      currentIndex: 0,
      currentTime: 0,
      isPlaying: true
    };

    console.log('📌 準備釘選播放器:', {
      userId: currentUser._id,
      currentUsername: currentUser.username,
      targetUserId,
      targetUsername,
      playlistLength: playlist.length,
      expiresAt: expiresAt.toISOString(),
      playlistSample: playlist[0]
    });
    console.log('📌 完整播放清單:', playlist);

    // 使用 updateOne 直接更新，避免 Mongoose 模型緩存問題
    const pinnedPlayerToSave = {
      userId: new mongoose.Types.ObjectId(targetUserId),
      username: targetUsername,
      playlist: playlist.map(track => ({
        title: String(track.title || ''),
        url: String(track.url || '')
      })),
      pinnedAt: pinnedAt,
      expiresAt: expiresAt,
      currentIndex: 0,
      currentTime: 0,
      isPlaying: true
    };

    // 使用 MongoDB 原生 collection 直接更新
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const result = await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(currentUser._id) },
      { $set: { pinnedPlayer: pinnedPlayerToSave } }
    );

    console.log('📌 更新結果（原生）:', result);

    // 重新查詢確認保存成功
    const updatedUserRaw = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(currentUser._id) }
    );
    
    console.log('📌 釘選播放器成功（原生查詢）:', {
      hasPinnedPlayer: !!updatedUserRaw.pinnedPlayer,
      pinnedPlayerUserId: updatedUserRaw.pinnedPlayer?.userId?.toString(),
      pinnedPlayerUsername: updatedUserRaw.pinnedPlayer?.username,
      pinnedPlayerPlaylistLength: updatedUserRaw.pinnedPlayer?.playlist?.length,
      pinnedPlayerExpiresAt: updatedUserRaw.pinnedPlayer?.expiresAt,
      fullData: updatedUserRaw.pinnedPlayer
    });

    // 直接返回我們設置的數據，而不依賴重新查詢
    return NextResponse.json({ 
      success: true, 
      message: `已釘選 @${targetUsername} 的播放器`,
      expiresAt: expiresAt,
      pinnedPlayer: pinnedPlayerToSave
    });

  } catch (error) {
    console.error('釘選播放器錯誤:', error);
    return NextResponse.json({ error: '釘選失敗' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 使用 MongoDB 原生 collection 直接更新（與 POST 一致）
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const result = await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(currentUser._id) },
      { $unset: { pinnedPlayer: 1 } }
    );

    // 重新查詢確認刪除成功
    const updatedUserRaw = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(currentUser._id) }
    );

    return NextResponse.json({ 
      success: true, 
      message: '已解除釘選播放器'
    });

  } catch (error) {
    console.error('解除釘選錯誤:', error);
    return NextResponse.json({ error: '解除釘選失敗' }, { status: 500 });
  }
}

// 更新釘選播放器狀態（播放進度、當前索引等）
export async function PATCH(request) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { currentIndex, currentTime, isPlaying } = await request.json();

    const updateData = {};
    if (currentIndex !== undefined) updateData['pinnedPlayer.currentIndex'] = currentIndex;
    if (currentTime !== undefined) updateData['pinnedPlayer.currentTime'] = currentTime;
    if (isPlaying !== undefined) updateData['pinnedPlayer.isPlaying'] = isPlaying;

    await User.findByIdAndUpdate(currentUser._id, updateData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('更新釘選播放器狀態錯誤:', error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}


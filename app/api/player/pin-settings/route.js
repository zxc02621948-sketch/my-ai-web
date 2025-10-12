import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

export async function PATCH(request) {
  try {
    await dbConnect();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { showReminder } = await request.json();

    await User.findByIdAndUpdate(currentUser._id, {
      'pinnedPlayerSettings.showReminder': showReminder
    });

    return NextResponse.json({ 
      success: true,
      showReminder: showReminder
    });

  } catch (error) {
    console.error('更新釘選播放器設置錯誤:', error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}



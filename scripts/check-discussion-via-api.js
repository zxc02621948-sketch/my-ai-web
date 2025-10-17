const axios = require('axios');

async function checkDiscussionPosts() {
  try {
    console.log('🔍 通過 API 檢查討論帖...');
    
    // 調用討論帖 API
    const response = await axios.get('http://localhost:3000/api/discussion/posts?page=1&limit=20&category=all&sort=newest');
    
    if (response.data && response.data.success && response.data.data) {
      const posts = response.data.data;
      console.log(`📋 找到 ${posts.length} 個討論帖:`);
      
      if (posts.length === 0) {
        console.log('❌ 沒有找到任何討論帖');
        return;
      }
      
      posts.forEach((post, index) => {
        console.log(`\n${index + 1}. ${post.title}`);
        console.log(`   - 作者: ${post.author?.username || '未知'}`);
        console.log(`   - 分類: ${post.category}`);
        console.log(`   - 圖片數量: ${post.imageCount || 0}`);
        console.log(`   - 點讚數: ${post.likes?.length || 0}`);
        console.log(`   - 待領取積分: ${post.pendingPoints || 0}`);
        console.log(`   - 已領取積分: ${post.claimedPoints || 0}`);
        console.log(`   - 獎勵用戶數: ${post.rewardedUsers?.length || 0}`);
        console.log(`   - 建立時間: ${post.createdAt}`);
      });

      // 找出多圖教學帖
      const multiImagePosts = posts.filter(post => post.imageCount > 1);
      console.log(`\n🎯 多圖教學帖 (${multiImagePosts.length} 個):`);
      multiImagePosts.forEach((post, index) => {
        console.log(`${index + 1}. ${post.title} - ${post.imageCount} 張圖片`);
      });

    } else {
      console.log('❌ API 返回數據格式不正確');
      console.log('API 返回內容:', JSON.stringify(response.data, null, 2));
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ 無法連接到 localhost:3000');
      console.log('💡 請確保開發服務器正在運行 (npm run dev)');
    } else {
      console.error('❌ 錯誤:', error.message);
    }
  }
}

checkDiscussionPosts();

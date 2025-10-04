const mongoose = require('mongoose');

// 連接到 MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/myaiweb';

// 圖片模型
const ImageSchema = new mongoose.Schema({
  title: String,
  imageId: String,
  imageUrl: String,
  platform: String,
  positivePrompt: String,
  negativePrompt: String,
  rating: String,
  category: String,
  description: String,
  tags: [String],
  author: String,
  modelName: String,
  loraName: String,
  modelLink: String,
  loraLink: String,
  steps: Number,
  sampler: String,
  cfgScale: Number,
  seed: String,
  clipSkip: Number,
  width: Number,
  height: Number,
  modelHash: String,
  userId: String,
  user: String,
  username: String,
  completenessScore: Number,
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', ImageSchema);

async function addSampleImages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 生成測試用戶 ID
    const testUserId = new mongoose.Types.ObjectId();
    
    const sampleImages = [
      {
        title: "色彩分明的少女藝術",
        imageUrl: "https://imagedelivery.net/your-cloudflare-account/placeholder1/public",
        platform: "Stable Diffusion",
        positivePrompt: "beautiful anime girl, colorful, detailed",
        negativePrompt: "blurry, low quality",
        rating: "sfw",
        category: "anime",
        description: "一張色彩豐富的動漫少女插畫",
        tags: ["anime", "girl", "colorful", "art"],
        author: "Test Artist",
        modelName: "Anime Model",
        steps: 20,
        sampler: "DPM++ 2M Karras",
        cfgScale: 7,
        seed: "12345",
        width: 512,
        height: 768,
        userId: testUserId,
        user: testUserId,
        username: "testuser",
        likes: 3,
        views: 15,
        clicks: 2
      },
      {
        title: "惡魔戰士",
        imageUrl: "https://imagedelivery.net/your-cloudflare-account/placeholder2/public",
        platform: "Stable Diffusion",
        positivePrompt: "demon warrior, dark fantasy, detailed armor",
        negativePrompt: "blurry, low quality",
        rating: "sfw",
        category: "fantasy",
        description: "黑暗奇幻風格的惡魔戰士",
        tags: ["fantasy", "demon", "warrior", "dark"],
        author: "Fantasy Artist",
        modelName: "Fantasy Model",
        steps: 25,
        sampler: "DPM++ 2M Karras",
        cfgScale: 8,
        seed: "67890",
        width: 768,
        height: 512,
        userId: testUserId,
        user: testUserId,
        username: "testuser",
        likes: 3,
        views: 22,
        clicks: 1
      },
      {
        title: "魔界之莉莉姆",
        imageUrl: "https://imagedelivery.net/your-cloudflare-account/placeholder3/public",
        platform: "Stable Diffusion",
        positivePrompt: "lilim demon girl, cute, fantasy",
        negativePrompt: "blurry, low quality",
        rating: "sfw",
        category: "anime",
        description: "可愛的魔界少女莉莉姆",
        tags: ["anime", "demon", "cute", "fantasy"],
        author: "Anime Artist",
        modelName: "Anime Model",
        steps: 30,
        sampler: "DPM++ 2M Karras",
        cfgScale: 7.5,
        seed: "11111",
        width: 512,
        height: 512,
        userId: testUserId,
        user: testUserId,
        username: "testuser",
        likes: 5,
        views: 18,
        clicks: 3
      },
      {
        title: "夕陽與少女",
        imageUrl: "https://imagedelivery.net/your-cloudflare-account/placeholder4/public",
        platform: "Stable Diffusion",
        positivePrompt: "sunset, girl, peaceful, warm colors",
        negativePrompt: "blurry, low quality",
        rating: "sfw",
        category: "landscape",
        description: "夕陽下的寧靜少女",
        tags: ["sunset", "girl", "peaceful", "warm"],
        author: "Landscape Artist",
        modelName: "Realistic Model",
        steps: 20,
        sampler: "DPM++ 2M Karras",
        cfgScale: 6,
        seed: "22222",
        width: 1024,
        height: 768,
        userId: testUserId,
        user: testUserId,
        username: "testuser",
        likes: 1,
        views: 8,
        clicks: 0
      },
      {
        title: "花叢中的少女",
        imageUrl: "https://imagedelivery.net/your-cloudflare-account/placeholder5/public",
        platform: "Stable Diffusion",
        positivePrompt: "girl in flower garden, beautiful, detailed",
        negativePrompt: "blurry, low quality",
        rating: "sfw",
        category: "nature",
        description: "花園中的美麗少女",
        tags: ["girl", "flowers", "garden", "beautiful"],
        author: "Nature Artist",
        modelName: "Nature Model",
        steps: 25,
        sampler: "DPM++ 2M Karras",
        cfgScale: 7,
        seed: "33333",
        width: 768,
        height: 1024,
        userId: testUserId,
        user: testUserId,
        username: "testuser",
        likes: 3,
        views: 12,
        clicks: 1
      }
    ];

    // 插入測試圖片
    const result = await Image.insertMany(sampleImages);
    console.log(`✅ 成功添加 ${result.length} 張測試圖片`);

    // 顯示添加的圖片
    result.forEach((img, index) => {
      console.log(`${index + 1}. ${img.title} (${img.likes} 喜歡)`);
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

addSampleImages();

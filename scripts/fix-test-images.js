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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', ImageSchema);

// 生成有效的 24 字符 ObjectId
function generateObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

// 測試圖片資料 - 使用正確的 ObjectId 格式
const testImages = [
  {
    title: "色彩分明的少女藝術",
    imageId: "test-image-1",
    imageUrl: "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-1/public",
    platform: "Stable Diffusion",
    positivePrompt: "anime girl, white hair, purple eyes, cat ears, purple and black outfit, white boots, low angle view, city street background, purple plants",
    negativePrompt: "nsfw, low quality, blurry",
    rating: "sfw",
    category: "anime",
    description: "一位動漫風格的少女，有白色短髮、紫色眼睛和貓耳",
    tags: ["anime", "girl", "cat ears", "purple", "art"],
    author: "TestUser",
    modelName: "Anything V5",
    loraName: "Cat Girl LoRA",
    userId: generateObjectId(),
    user: generateObjectId(),
    username: "TestUser",
    completenessScore: 85,
    likes: 3,
    views: 15
  },
  {
    title: "惡魔戰士",
    imageId: "test-image-2", 
    imageUrl: "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-2/public",
    platform: "Stable Diffusion",
    positivePrompt: "demon warrior, dark blue armor, burning skull head, sword, fire background",
    negativePrompt: "nsfw, low quality",
    rating: "sfw",
    category: "fantasy",
    description: "一位身穿深藍色盔甲的惡魔戰士",
    tags: ["demon", "warrior", "armor", "fire", "fantasy"],
    author: "TestUser",
    modelName: "Anything V5",
    userId: generateObjectId(),
    user: generateObjectId(), 
    username: "TestUser",
    completenessScore: 90,
    likes: 3,
    views: 12
  },
  {
    title: "魔界之莉莉姆 魔界ノりりむ Makaino Rir...",
    imageId: "test-image-3",
    imageUrl: "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-3/public", 
    platform: "Stable Diffusion",
    positivePrompt: "anime girl, light brown hair, pink eyes, red demon wings, maid outfit, sitting on pink cube, winking, pointing, red heart icon",
    negativePrompt: "nsfw, low quality",
    rating: "sfw",
    category: "anime",
    description: "一個動漫風格的迷你公仔，魔界之莉莉姆",
    tags: ["anime", "girl", "demon", "maid", "cute", "vtuber"],
    author: "TestUser",
    modelName: "Anything V5",
    loraName: "Maid LoRA",
    userId: generateObjectId(),
    user: generateObjectId(),
    username: "TestUser", 
    completenessScore: 88,
    likes: 5,
    views: 20
  },
  {
    title: "夕陽與少女",
    imageId: "test-image-4",
    imageUrl: "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-4/public",
    platform: "Stable Diffusion", 
    positivePrompt: "anime girl, long hair, white dress, standing on rooftop, sunset, city view, mountains in distance",
    negativePrompt: "nsfw, low quality",
    rating: "sfw",
    category: "anime",
    description: "一位動漫風格的長髮少女，站在屋頂上俯瞰夕陽",
    tags: ["anime", "girl", "sunset", "rooftop", "city", "landscape"],
    author: "TestUser",
    modelName: "Anything V5",
    userId: generateObjectId(),
    user: generateObjectId(),
    username: "TestUser",
    completenessScore: 82,
    likes: 1,
    views: 8
  },
  {
    title: "花叢中的少女",
    imageId: "test-image-5",
    imageUrl: "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-5/public",
    platform: "Stable Diffusion",
    positivePrompt: "anime girl, long blonde hair, blue eyes, white flowing dress, surrounded by blue and pink roses, white lilies, flower garden",
    negativePrompt: "nsfw, low quality",
    rating: "sfw", 
    category: "anime",
    description: "一位動漫風格的長髮金髮少女，被花叢環繞",
    tags: ["anime", "girl", "flowers", "garden", "blonde", "elegant"],
    author: "TestUser",
    modelName: "Anything V5",
    loraName: "Flower Garden LoRA",
    userId: generateObjectId(),
    user: generateObjectId(),
    username: "TestUser",
    completenessScore: 92,
    likes: 3,
    views: 18
  }
];

async function fixTestImages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 清空現有圖片
    await Image.deleteMany({});
    console.log('🗑️ 已清空現有圖片');

    // 添加修復後的測試圖片
    const insertedImages = await Image.insertMany(testImages);
    console.log(`✅ 已添加 ${insertedImages.length} 張修復後的測試圖片`);

    // 顯示添加的圖片
    insertedImages.forEach((img, index) => {
      console.log(`${index + 1}. ${img.title} (${img.likes} 喜歡) - UserId: ${img.userId}`);
    });

    console.log('🎉 測試圖片修復完成！');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

fixTestImages();

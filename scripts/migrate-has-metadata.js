// scripts/migrate-has-metadata.js
// 為現有圖片添加 hasMetadata 標記

import mongoose from "mongoose";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 手動讀取 .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let MONGODB_URI;
try {
  const envPath = join(__dirname, '../.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  const match = envFile.match(/MONGODB_URI=(.+)/);
  if (match) {
    MONGODB_URI = match[1].trim().replace(/^["']|["']$/g, '');
  }
} catch (error) {
  console.error("❌ 無法讀取 .env.local 文件");
}

if (!MONGODB_URI) {
  console.error("❌ 錯誤：找不到 MONGODB_URI");
  console.log("請確保 .env.local 文件中有設置 MONGODB_URI");
  process.exit(1);
}

console.log("📝 使用數據庫：", MONGODB_URI.replace(/\/\/(.+):(.+)@/, '//*****:*****@'));

async function migrateHasMetadata() {
  try {
    console.log("🔌 連接數據庫...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ 數據庫連接成功");

    // 直接使用 mongoose.connection.collection
    const imagesCollection = mongoose.connection.collection('images');
    
    const totalImages = await imagesCollection.countDocuments({});
    console.log(`📊 總圖片數量：${totalImages}`);

    let updated = 0;
    let alreadySet = 0;
    let batch = 0;
    const BATCH_SIZE = 100;

    const cursor = imagesCollection.find({}).batchSize(BATCH_SIZE);

    for await (const img of cursor) {
      batch++;
      
      // 判斷是否有元數據
      const hasMetadata = !!(
        img.positivePrompt?.trim() ||
        img.negativePrompt?.trim() ||
        img.modelName?.trim() ||
        img.sampler?.trim() ||
        img.seed ||
        img.steps ||
        img.cfgScale ||
        img.width ||
        img.height
      );

      // 檢查是否需要更新
      if (img.hasMetadata !== hasMetadata) {
        await imagesCollection.updateOne(
          { _id: img._id },
          { $set: { hasMetadata } }
        );
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`  ⏳ 已處理 ${batch} 張圖片，更新了 ${updated} 張...`);
        }
      } else {
        alreadySet++;
      }
    }

    console.log("\n✅ 遷移完成！");
    console.log(`📊 統計：`);
    console.log(`  - 總圖片數：${totalImages}`);
    console.log(`  - 已更新：${updated}`);
    console.log(`  - 無需更新：${alreadySet}`);
    console.log(`  - 有元數據：${await imagesCollection.countDocuments({ hasMetadata: true })}`);
    console.log(`  - 無元數據：${await imagesCollection.countDocuments({ hasMetadata: false })}`);

  } catch (error) {
    console.error("❌ 遷移失敗：", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 數據庫連接已關閉");
    process.exit(0);
  }
}

migrateHasMetadata();


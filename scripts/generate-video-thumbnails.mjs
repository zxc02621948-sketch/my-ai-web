#!/usr/bin/env node

import nextEnv from '@next/env';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import mongoose from 'mongoose';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { dbConnect } = await import('../lib/db.js');
const { uploadToR2, R2_PUBLIC_URL } = await import('../lib/r2.js');

const Video =
  mongoose.models.Video ||
  mongoose.model(
    'Video',
    new mongoose.Schema(
      {
        title: { type: String },
        videoUrl: { type: String },
        thumbnailUrl: { type: String, default: '' },
        streamId: { type: String, default: '' },
        previewUrl: { type: String, default: '' },
      },
      { timestamps: true }
    )
  );

const TMP_PREFIX = 'aiweb-thumb-';
const OUTPUT_WIDTH = parseInt(process.env.VIDEO_THUMB_WIDTH || '1280', 10);
const SAMPLE_OFFSET = process.env.VIDEO_THUMB_OFFSET || '0.5'; // 秒

async function ensureFfmpeg() {
  return new Promise((resolve, reject) => {
    const probe = spawn('ffmpeg', ['-version']);
    probe.once('error', (err) => {
      reject(
        new Error(
          `找不到 ffmpeg，請先在環境中安裝。\n原始錯誤：${err.message}`
        )
      );
    });
    probe.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('ffmpeg 無法執行，請確認可在 shell 中呼叫'));
      }
    });
  });
}

async function downloadVideo(url, destination) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下載影片失敗，狀態碼 ${res.status}`);
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(destination, Buffer.from(arrayBuffer));
}

async function generateThumbnail(inputPath, outputPath) {
  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss',
      SAMPLE_OFFSET,
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${OUTPUT_WIDTH}:-1:flags=lanczos`,
      outputPath,
    ];

    const ff = spawn('ffmpeg', args);

    ff.stderr.on('data', () => {
      // 靜默輸出，避免淹沒終端；需要時可改成 console.log
    });

    ff.once('error', reject);
    ff.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg 產生縮圖失敗，退出碼 ${code}`));
      }
    });
  });

  await fs.access(outputPath);
  const stat = await fs.stat(outputPath);
  if (stat.size === 0) {
    throw new Error('縮圖檔案大小為 0，可能產生失敗');
  }
}

async function processVideo(video) {
  if (!video.videoUrl) {
    throw new Error('缺少 videoUrl');
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
  const inputPath = path.join(tmpDir, 'source');
  const outputPath = path.join(tmpDir, 'thumb.jpg');

  try {
    await downloadVideo(video.videoUrl, inputPath);
    await generateThumbnail(inputPath, outputPath);

    const thumbBuffer = await fs.readFile(outputPath);
    const key = `videos/thumbnails/${video._id}.jpg`;
    const publicUrl = await uploadToR2(thumbBuffer, key, 'image/jpeg');

    video.thumbnailUrl = publicUrl || `${R2_PUBLIC_URL}/${key}`;
    await video.save();

    return { status: 'success', url: video.thumbnailUrl };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  try {
    await ensureFfmpeg();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  await dbConnect();
  console.log('✅ 已連接 MongoDB');

  const query = {
    $or: [
      { thumbnailUrl: { $exists: false } },
      { thumbnailUrl: { $eq: '' } },
      { thumbnailUrl: { $eq: null } },
    ],
    videoUrl: { $exists: true, $ne: '' },
  };

  const limitArgIndex = process.argv.findIndex((arg) => arg === '--limit');
  let limit = 0;
  if (limitArgIndex !== -1 && process.argv[limitArgIndex + 1]) {
    limit = parseInt(process.argv[limitArgIndex + 1], 10) || 0;
  }

  const cursor = Video.find(query).sort({ createdAt: 1 });
  if (limit > 0) {
    cursor.limit(limit);
  }

  const videos = await cursor.exec();
  if (videos.length === 0) {
    console.log('🎉 沒有需要補縮圖的影片，任務完成');
    await mongoose.disconnect();
    return;
  }

  console.log(`📹 準備為 ${videos.length} 支影片產生縮圖`);

  let success = 0;
  let failed = 0;

  for (const video of videos) {
    console.log(`\n▶️ 處理影片 ${video._id}：${video.title || '(未命名)'}`);
    try {
      const result = await processVideo(video);
      success += 1;
      console.log(`   ✅ 已上傳縮圖：${result.url}`);
    } catch (error) {
      failed += 1;
      console.error(`   ❌ 失敗：${error.message}`);
    }
  }

  console.log('\n===== 結果 =====');
  console.log(`✅ 成功：${success}`);
  console.log(`❌ 失敗：${failed}`);

  await mongoose.disconnect();
  console.log('👋 已關閉資料庫連線');
}

main().catch((error) => {
  console.error('❌ 執行腳本時發生錯誤：', error);
  mongoose.disconnect().finally(() => process.exit(1));
});



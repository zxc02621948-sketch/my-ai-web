import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";

// 健康检查端点 - 保持 serverless functions 温暖
export async function GET() {
  try {
    // 简单的数据库连接测试（保持连接池活跃）
    await dbConnect();
    
    return NextResponse.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      message: "Server is warm"
    });
  } catch (error) {
    return NextResponse.json({ 
      status: "error", 
      error: error.message 
    }, { status: 500 });
  }
}


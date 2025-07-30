import { NextResponse } from "next/server";
import FormData from "form-data";
import fetch from "node-fetch";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !file.name || !file.arrayBuffer) {
      return NextResponse.json({ success: false, message: "Invalid file upload" }, { status: 400 });
    }

    // 將 file 轉為 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cfForm = new FormData();
    cfForm.append("file", buffer, file.name);

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...cfForm.getHeaders(),
      },
      body: cfForm,
    });

    const result = await response.json();

    if (!result.success) {
      console.error("Cloudflare upload failed:", result);
      return NextResponse.json({ success: false, message: "Cloudflare upload failed", errors: result.errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageId: result.result.id }, { status: 200 });
  } catch (error) {
    console.error("Error uploading to Cloudflare:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    const imageCount = await db.collection("images").countDocuments();

    return NextResponse.json({
      database: db.databaseName,
      collections: collectionNames,
      imagesInImagesCollection: imageCount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

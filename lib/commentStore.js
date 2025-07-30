import clientPromise from "./mongodb";

export const commentStore = {
  async addComment({ imageId, content, userId }) {
    const client = await clientPromise;
    const db = client.db(); // 使用預設資料庫
    const commentsCollection = db.collection("comments");

    const comment = {
      imageId,
      content,
      userId,
      createdAt: new Date(),
    };

    const result = await commentsCollection.insertOne(comment);
    return result.insertedId;
  },

  async getComments(imageId) {
    const client = await clientPromise;
    const db = client.db();
    const commentsCollection = db.collection("comments");

    const comments = await commentsCollection
      .find({ imageId })
      .sort({ createdAt: -1 })
      .toArray();

    return comments;
  },
};

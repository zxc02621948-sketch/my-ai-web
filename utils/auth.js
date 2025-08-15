import jwt from "jsonwebtoken";
import User from "@/models/User";
import { dbConnect } from "../lib/db";

export async function requireUser(req) {
  await dbConnect(); // 先確保 Mongo 已連線
  const token = req.cookies?.get?.("token")?.value;
  if (!token) throw new Error("UNAUTH");
  const data = jwt.decode(token);
  const u = await User.findById(data?._id || data?.id).lean();
  if (!u) throw new Error("UNAUTH");
  return u;
}

export async function requireAdmin(req) {
  const u = await requireUser(req);
  if (!u.isAdmin) throw new Error("FORBIDDEN");
  return u;
}

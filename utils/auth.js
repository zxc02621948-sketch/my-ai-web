import jwt from "jsonwebtoken";
import User from "@/models/User";

export async function requireUser(req) {
  const token = req.cookies?.get?.("token")?.value;
  if (!token) throw new Error("UNAUTH");
  const data = jwt.decode(token);
  const u = await User.findById(data?._id || data?.id);
  if (!u) throw new Error("UNAUTH");
  return u;
}

export async function requireAdmin(req) {
  const u = await requireUser(req);
  if (!u.isAdmin) throw new Error("FORBIDDEN");
  return u;
}

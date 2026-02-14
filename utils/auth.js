import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function requireUser(req) {
  const user = await getCurrentUserFromRequest(req).catch(() => null);
  if (!user) throw new Error("UNAUTH");
  return user;
}

export async function requireAdmin(req) {
  const u = await requireUser(req);
  if (!u.isAdmin) throw new Error("FORBIDDEN");
  return u;
}

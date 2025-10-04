// app/api/admin/analytics/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import User from "@/models/User";
import { requireAdmin } from "@/lib/authUtils";
import { apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const GET = requireAdmin(
  withErrorHandling(async (req, context) => {
    await dbConnect();
    
    const logs = await VisitorLog.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("userId", "name email");
    
    return apiSuccess({ logs });
  })
);

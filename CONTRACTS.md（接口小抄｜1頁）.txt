# CONTRACTS (stable interfaces)

## Auth / Infra（不可隨意改）
- lib/db.js: export { dbConnect }  // mongoose.connect()
- lib/serverAuth.js: export { serverAuth } // 取得當前使用者或丟 401/403
- lib/mailer.js: export { sendMail } // 流程= throttle → write DB → send

---

## /api/images (列表)
GET /api/images?page&limit&sort&search&categories&ratings
→ 200 { items: [...], total, page, limit }

## /api/images/[id] (單張)
GET /api/images/:id
→ 200 { image }

## /api/images/[id]/click (點擊統計)
POST /api/images/:id/click
→ 200 { ok: true, clicks, likesCount, popScore }

## /api/like-image (點讚/收回)
PUT /api/like-image?id=:imageId   (需要 Authorization: Bearer <jwt>)
→ 200 { ok: true, likes: [userId...] }

## /api/follow (追蹤/取消)
POST /api/follow
body: { userIdToFollow }
→ 200 { ok: true }
DELETE /api/follow
body: { userIdToUnfollow }
→ 200 { ok: true }

## /api/delete-image (刪圖+系統訊息)
DELETE /api/delete-image
body: { imageId, reason? = "policy_violation" | "category_wrong" | "rating_wrong" }
→ 200 { ok: true } // 會透過 lib/mailer 或站內信發通知

## /api/messages/thread (載入站內信)
GET /api/messages/thread?id=pair:<userId>:system | pair:<a>:<b>
→ 200 { items: [...], archived: bool }

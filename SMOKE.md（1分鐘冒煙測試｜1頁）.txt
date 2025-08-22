# SMOKE (run before deploy)

## 1) 列表
curl -sS "https://<host>/api/images?page=1&limit=5" | jq '.items | length'

## 2) 單張
IMG_ID="<填任一圖片ID>"
curl -sS "https://<host>/api/images/$IMG_ID" | jq '.image._id'

## 3) 點擊
curl -sS -X POST "https://<host>/api/images/$IMG_ID/click" | jq '.ok,.popScore'

## 4) 讚（需 token）
TOKEN="<你的JWT>"
curl -sS -X PUT "https://<host>/api/like-image?id=$IMG_ID" -H "Authorization: Bearer $TOKEN" | jq '.likes | length'

## 5) 追蹤/取消（需 token）
USER_ID="<作者ID>"
curl -sS -X POST "https://<host>/api/follow" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"userIdToFollow\":\"$USER_ID\"}" | jq '.ok'
curl -sS -X DELETE "https://<host>/api/follow" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"userIdToUnfollow\":\"$USER_ID\"}" | jq '.ok'

## 6) 刪圖（小心）
curl -sS -X DELETE "https://<host>/api/delete-image" -H "Content-Type: application/json" -d "{\"imageId\":\"$IMG_ID\"}" | jq '.ok'

## 7) 站內信
PAIR_ID="pair:<userId>:system"
curl -sS "https://<host>/api/messages/thread?id=$PAIR_ID" | jq '.items | length'

# 通過標準：以上呼叫皆 200，且 jq 能取到對應欄位

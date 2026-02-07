# 檢查 AWS CLI 使用的憑證指紋（用於與後端比對）
# 使用方法：在 PowerShell 中運行此腳本

Write-Host "🔍 AWS CLI 憑證指紋檢查" -ForegroundColor Cyan
Write-Host ""

# ✅ 檢查環境變數
$accessKeyId = $env:AWS_ACCESS_KEY_ID
$secretAccessKey = $env:AWS_SECRET_ACCESS_KEY

if (-not $accessKeyId) {
    Write-Host "❌ AWS_ACCESS_KEY_ID 環境變數未設置" -ForegroundColor Red
    Write-Host "   請先設置: `$env:AWS_ACCESS_KEY_ID = 'your-access-key'" -ForegroundColor Yellow
    exit 1
}

if (-not $secretAccessKey) {
    Write-Host "❌ AWS_SECRET_ACCESS_KEY 環境變數未設置" -ForegroundColor Red
    Write-Host "   請先設置: `$env:AWS_SECRET_ACCESS_KEY = 'your-secret-key'" -ForegroundColor Yellow
    exit 1
}

# ✅ 計算 Access Key 尾碼（後 6 碼）
$accessKeyTail = $accessKeyId.Substring($accessKeyId.Length - 6)
Write-Host "✅ Access Key 尾碼（後 6 碼）: $accessKeyTail" -ForegroundColor Green

# ✅ 計算 Secret Key 的 SHA256 hash（前 8 碼）
$bytes = [System.Text.Encoding]::UTF8.GetBytes($secretAccessKey)
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash($bytes)
$hashHex = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$secretHash8 = $hashHex.Substring(0, 8)
Write-Host "✅ Secret Key Hash（前 8 碼）: $secretHash8" -ForegroundColor Green

Write-Host ""
Write-Host "📋 比對說明：" -ForegroundColor Cyan
Write-Host "   1. 將上述兩個值與後端日誌中的 'accessKeyTail' 和 'secretHash8' 比對" -ForegroundColor Yellow
Write-Host "   2. 如果值相同 → 後端使用的是同一組憑證 ✅" -ForegroundColor Green
Write-Host "   3. 如果值不同 → 後端使用的是不同的憑證 ❌" -ForegroundColor Red
Write-Host ""
Write-Host "💡 如果值不同，請檢查：" -ForegroundColor Cyan
Write-Host "   - .env.local 中的 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY" -ForegroundColor Yellow
Write-Host "   - 是否重啟了 Next.js dev server（環境變數需要重啟才能生效）" -ForegroundColor Yellow
Write-Host "   - 環境變數名稱是否一致（AWS_ vs R2_）" -ForegroundColor Yellow











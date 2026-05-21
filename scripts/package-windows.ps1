# Đóng gói BLaoBarber cho máy Windows (thư mục release\BLaoBarber)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Out = Join-Path $Root "release\BLaoBarber"

Write-Host "==> Build giao dien..." -ForegroundColor Cyan
Push-Location $Root
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "==> Cai dat phu thuoc san xuat..." -ForegroundColor Cyan
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path $Out -Force | Out-Null

$copy = @(
  "package.json",
  "package-lock.json",
  "Mo-Quan-Ly-Tiem.bat",
  "HUONG-DAN-CAI-DAT.md"
)
foreach ($f in $copy) {
  Copy-Item (Join-Path $Root $f) (Join-Path $Out $f) -ErrorAction SilentlyContinue
}

Copy-Item (Join-Path $Root "dist") (Join-Path $Out "dist") -Recurse
Copy-Item (Join-Path $Root "server") (Join-Path $Out "server") -Recurse
Copy-Item (Join-Path $Root "scripts") (Join-Path $Out "scripts") -Recurse

Push-Location $Out
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { Pop-Location; Pop-Location; exit 1 }
Pop-Location
Pop-Location

Write-Host ""
Write-Host "Xong! Thu muc san sang:" -ForegroundColor Green
Write-Host "  $Out"
Write-Host ""
Write-Host "Tren may tiem:" -ForegroundColor Yellow
Write-Host "  1. Copy ca thu muc BLaoBarber len may (vd. C:\BLaoBarber)"
Write-Host "  2. Can Node.js 22+ (cai 1 lan) HOAC dat runtime\node\node.exe"
Write-Host "  3. Double-click Mo-Quan-Ly-Tiem.bat hoac tao shortcut Desktop"
Write-Host ""

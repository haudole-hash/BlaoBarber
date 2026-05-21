# Installer .exe - cai 1 lan, tu tao shortcut Desktop
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Staging = Join-Path $Root "pack-staging"
$NodeExe = Join-Path $Root "runtime\node\node.exe"

Push-Location $Root

Write-Host "==> Build UI..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Vite build failed" }

Write-Host "==> Bundle server..." -ForegroundColor Cyan
node scripts/build-server.mjs
if ($LASTEXITCODE -ne 0) { throw "Server bundle failed" }

Write-Host "==> Node portable..." -ForegroundColor Cyan
& "$Root\scripts\download-node-portable.ps1"
if (-not (Test-Path $NodeExe)) { throw "Node portable missing" }

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $Staging "app") -Force | Out-Null
Copy-Item (Join-Path $Root "dist") (Join-Path $Staging "app\dist") -Recurse
Copy-Item (Join-Path $Root "dist-server") (Join-Path $Staging "app\dist-server") -Recurse

Write-Host "==> Clean old release..." -ForegroundColor Cyan
& "$Root\scripts\clean-release.ps1"
if ($LASTEXITCODE -ne 0) { throw "clean-release failed" }

Write-Host "==> Building installer NSIS (5-15 minutes)..." -ForegroundColor Cyan
npm exec electron-builder -- --win nsis --x64
if ($LASTEXITCODE -ne 0) { throw "electron-builder NSIS failed" }

Pop-Location

$Setup = Get-ChildItem (Join-Path $Root "release") -Filter "*Setup*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host ""
if ($Setup) {
  Write-Host "DONE - File gui cho tiem:" -ForegroundColor Green
  Write-Host "  $($Setup.FullName)"
  Write-Host ""
  Write-Host "Tren may tiem:" -ForegroundColor Cyan
  Write-Host "  1. Bam file Setup (1 lan)"
  Write-Host "  2. Tu co shortcut Desktop: BLao Quan ly tiem"
  Write-Host "  3. Hang ngay bam shortcut, KHONG bam lai Setup"
} else {
  Write-Host "Build xong nhung khong thay *Setup*.exe trong release\" -ForegroundColor Yellow
  Write-Host "Xem thu muc: $Root\release"
}
Write-Host ""

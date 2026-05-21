# Build single portable .exe for shop (no Node install on target PC)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Staging = Join-Path $Root "pack-staging"
$NodeExe = Join-Path $Root "runtime\node\node.exe"

Push-Location $Root

Write-Host "==> Build UI (Vite)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "==> Bundle server..." -ForegroundColor Cyan
node scripts/build-server.mjs
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "==> Node portable (download if needed)..." -ForegroundColor Cyan
& "$Root\scripts\download-node-portable.ps1"
if (-not (Test-Path $NodeExe)) {
  Write-Host "ERROR: Node portable not found." -ForegroundColor Red
  Pop-Location
  exit 1
}

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $Staging "app") -Force | Out-Null
Copy-Item (Join-Path $Root "dist") (Join-Path $Staging "app\dist") -Recurse
Copy-Item (Join-Path $Root "dist-server") (Join-Path $Staging "app\dist-server") -Recurse

& "$Root\scripts\clean-release.ps1"
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Write-Host "==> Electron portable (may take several minutes)..." -ForegroundColor Cyan
npm exec electron-builder -- --win portable
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

Pop-Location

$Exe = Get-ChildItem (Join-Path $Root "release") -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
Write-Host "DONE - Send this file to the shop:" -ForegroundColor Green
if ($Exe) { Write-Host "  $($Exe.FullName)" }
Write-Host ""
Write-Host "Size about 150-200 MB (includes Node + app)." -ForegroundColor Yellow
Write-Host "Data saved at: %APPDATA%\BLaoBarber\data.db" -ForegroundColor Yellow
Write-Host ""

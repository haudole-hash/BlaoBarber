# Dong app / giai phong thu muc release truoc khi build lai
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Release = Join-Path $Root "release"

Write-Host "==> Stop BLaoBarber / Electron (if running)..." -ForegroundColor Cyan

$killNames = @(
  "BLao Quan ly tiem.exe",
  "BLaoBarber.exe"
)
foreach ($n in $killNames) {
  cmd /c "taskkill /F /IM `"$n`" >nul 2>&1"
}

Get-Process -Name "electron" -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $p = $_.Path
    if ($p -and ($p -like "*\BLaoBarber\*" -or $p -like "*\release\*")) {
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}

Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $p = $_.Path
    if ($p -and $p -like "*\BLaoBarber\*") {
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}

Start-Sleep -Seconds 2

if (-not (Test-Path $Release)) {
  Write-Host "Release folder already clean."
  exit 0
}

Write-Host "==> Delete folder: $Release" -ForegroundColor Cyan
try {
  Remove-Item $Release -Recurse -Force -ErrorAction Stop
  Write-Host "OK."
  exit 0
} catch {
  Write-Host ""
  Write-Host "ERROR: Cannot delete release folder (file in use)." -ForegroundColor Red
  Write-Host "  1. Close BLaoBarber app window if open" -ForegroundColor Yellow
  Write-Host "  2. Close File Explorer on release folder" -ForegroundColor Yellow
  Write-Host "  3. Run again: npm run package:setup" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

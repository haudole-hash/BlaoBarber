# Tao file ZIP de gui cho tiem (sau khi da chay package-windows.ps1)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Src = Join-Path $Root "release\BLaoBarber"
$Zip = Join-Path $Root "release\BLaoBarber-gui-tiem.zip"

if (-not (Test-Path $Src)) {
  Write-Host "Chua co release\BLaoBarber. Chay truoc: npm run package:win" -ForegroundColor Red
  exit 1
}

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path $Src -DestinationPath $Zip -Force

Write-Host ""
Write-Host "Da tao file gui tiem:" -ForegroundColor Green
Write-Host "  $Zip"
Write-Host ""
Write-Host "Huong dan cho chu tiem:" -ForegroundColor Yellow
Write-Host "  1. Giai nen ZIP vao vi du C:\BLaoBarber"
Write-Host "  2. Bam doi Mo-Quan-Ly-Tiem.bat"
Write-Host "  (KHONG chi copy file .bat ra Desktop ma khong co thu muc con lai)"
Write-Host ""

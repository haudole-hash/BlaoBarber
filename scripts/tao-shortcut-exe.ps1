# Tao shortcut Desktop — uu tien ban win-unpacked (mo NHANH hon portable)
param(
  [string]$ExePath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $ExePath) {
  $unpacked = Join-Path $Root "release\win-unpacked\BLao Quan ly tiem.exe"
  $portable = Get-ChildItem (Join-Path $Root "release") -Filter "*portable*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

  if (Test-Path $unpacked) {
    $ExePath = $unpacked
    $mode = "win-unpacked (nhanh)"
  } elseif ($portable) {
    $ExePath = $portable.FullName
    $mode = "portable (cham hon - giai nen moi lan)"
  } else {
    Write-Host ""
    Write-Host "Khong tim thay .exe. Chay package:exe truoc." -ForegroundColor Red
    Write-Host '  npm run shortcut:exe -- "duong\dan\file.exe"'
    Write-Host ""
    exit 1
  }
} else {
  $mode = "tuy chon"
}

if (-not (Test-Path $ExePath)) {
  Write-Host "Khong tim thay: $ExePath" -ForegroundColor Red
  exit 1
}

$shortcutName = "BLao Quan ly tiem.lnk"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop $shortcutName

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnk)
$sc.TargetPath = $ExePath
$sc.WorkingDirectory = Split-Path $ExePath
$sc.Description = "Mo BLaoBarber"
$sc.Save()

Write-Host ""
Write-Host "=== DA TAO / CAP NHAT SHORTCUT ===" -ForegroundColor Green
Write-Host "  $lnk"
Write-Host "  -> $ExePath"
Write-Host "  Loai: $mode"
Write-Host ""
Write-Host "MO NHANH NHU WORD?" -ForegroundColor Cyan
Write-Host "  - Lan dau van doi vai giay (khong bang Word)"
Write-Host "  - Sau khi dong cua so X: app chay nen (khay he thong)"
Write-Host "  - Bam shortcut lan 2: mo gan nhu ngay"
Write-Host "  - Thu muc win-unpacked phai giu nguyen (khong chi gui 1 file portable)"
Write-Host ""

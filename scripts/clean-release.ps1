# Giai phong release\ truoc package - uu tien doi ten (khong can xoa ngay)
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Release = Join-Path $Root "release"

function Stop-BlaoProcesses {
  Write-Host "==> Stop BLaoBarber / dev server (if running)..." -ForegroundColor Cyan

  $killNames = @(
    "BLao Quan ly tiem.exe",
    "BLaoBarber.exe",
    "electron.exe"
  )
  foreach ($n in $killNames) {
    cmd /c "taskkill /F /IM `"$n`" >nul 2>&1"
  }

  try {
    Get-NetTCPConnection -LocalPort 3847 -ErrorAction SilentlyContinue | ForEach-Object {
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch {
    $lines = netstat -ano 2>$null | Select-String ":3847\s"
    foreach ($line in $lines) {
      $procId = ($line -split "\s+")[-1]
      if ($procId -match "^\d+$") {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
      }
    }
  }

  $rootNorm = $Root.ToLowerInvariant()
  $relNorm = $Release.ToLowerInvariant()
  Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $p = $_.Path
      if (-not $p) { return }
      $pNorm = $p.ToLowerInvariant()
      if ($pNorm.StartsWith($relNorm) -or $pNorm.StartsWith($rootNorm)) {
        if ($_.ProcessName -match "^(electron|node)$" -or $pNorm -like "*\release\*") {
          Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
      }
    } catch { }
  }

  if ($env:BLAO_KILL_ALL_NODE -eq "1") {
    Write-Host "  (force) Stopping all node.exe under $Root ..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        if ($_.Path -and $_.Path.ToLowerInvariant().StartsWith($rootNorm)) {
          Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
      } catch { }
    }
  }

  Start-Sleep -Seconds 2
}

Stop-BlaoProcesses

$env:BLAO_ELECTRON_OUTPUT = "release"

if (-not (Test-Path $Release)) {
  New-Item -ItemType Directory -Path $Release -Force | Out-Null
  Write-Host "Release folder ready (empty)."
  exit 0
}

$oldFolderName = "release._old_" + (Get-Date -Format "yyyyMMdd_HHmmss")
$oldPath = Join-Path $Root $oldFolderName

Write-Host "==> Move old release aside: $oldFolderName" -ForegroundColor Cyan
try {
  Rename-Item -Path $Release -NewName $oldFolderName -ErrorAction Stop
  New-Item -ItemType Directory -Path $Release -Force | Out-Null
  Write-Host "OK - old build moved to: $oldPath" -ForegroundColor Green
  Write-Host "  (Co the xoa folder _old sau khi tat het app.)" -ForegroundColor DarkGray
  exit 0
} catch {
  Write-Host "  Cannot rename release\ (still locked)." -ForegroundColor Yellow
}

Write-Host "==> Try delete release\ ..." -ForegroundColor Cyan
for ($i = 1; $i -le 3; $i++) {
  try {
    Remove-Item $Release -Recurse -Force -ErrorAction Stop
    New-Item -ItemType Directory -Path $Release -Force | Out-Null
    Write-Host "OK."
    exit 0
  } catch {
    Stop-BlaoProcesses
    Start-Sleep -Seconds 2
  }
}

$alt = "release-build-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$altPath = Join-Path $Root $alt
Write-Host ""
Write-Host "WARN: Folder release\ is locked." -ForegroundColor Yellow
Write-Host "  Building installer to: $alt\" -ForegroundColor Yellow
Write-Host "  (Sau khi tat app, xoa tay: release\ va cac release._old_* )" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Thuong do npm run dev con chay trong Cursor/terminal - tat (Ctrl+C) roi package lai." -ForegroundColor Cyan
Write-Host ""

$env:BLAO_ELECTRON_OUTPUT = $alt
New-Item -ItemType Directory -Path $altPath -Force | Out-Null
exit 0

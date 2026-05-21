# Tạo shortcut Desktop trỏ tới Mo-Quan-Ly-Tiem.bat
param(
  [string]$AppDir = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
)

$bat = Join-Path $AppDir "Mo-Quan-Ly-Tiem.bat"
if (-not (Test-Path $bat)) {
  Write-Error "Khong tim thay: $bat"
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop "B'Lao Quan ly tiem.lnk"

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnk)
$sc.TargetPath = $bat
$sc.WorkingDirectory = $AppDir
$sc.Description = "Mo phan mem quan ly tiem B'Lao"
$sc.Save()

Write-Host "Da tao shortcut:" -ForegroundColor Green
Write-Host "  $lnk"

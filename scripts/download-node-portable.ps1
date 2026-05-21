# Download Node Windows zip for portable .exe build (dev machine only)
$ErrorActionPreference = "Stop"
$NodeVersion = "22.16.0"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dest = Join-Path $Root "runtime\node"
$NodeExe = Join-Path $Dest "node.exe"

if (Test-Path $NodeExe) {
  Write-Host "Node portable already exists:" $NodeExe
  exit 0
}

$ZipName = "node-v$NodeVersion-win-x64.zip"
$Url = "https://nodejs.org/dist/v$NodeVersion/$ZipName"
$TempZip = Join-Path $env:TEMP $ZipName
$ExtractDir = Join-Path $env:TEMP "node-portable-extract"

Write-Host "Downloading Node $NodeVersion ..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $Url -OutFile $TempZip -UseBasicParsing

if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }
Expand-Archive -Path $TempZip -DestinationPath $ExtractDir -Force

$Inner = Get-ChildItem $ExtractDir -Directory | Select-Object -First 1
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path (Split-Path $Dest) -Force | Out-Null
Move-Item $Inner.FullName $Dest

Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
Remove-Item $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "OK:" $NodeExe -ForegroundColor Green

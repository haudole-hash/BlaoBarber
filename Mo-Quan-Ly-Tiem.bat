@echo off
chcp 65001 >nul
title B'Lao - Quản lý tiệm

REM Luôn chạy trong thư mục chứa file .bat này (không phải Desktop nếu chỉ copy mỗi file .bat)
cd /d "%~dp0"

echo.
echo  B'Lao - Quan ly tiem
echo  Thu muc: %~dp0
echo.

if not exist "%~dp0scripts\launch.mjs" (
  echo  [LOI] Thieu file scripts\launch.mjs
  echo.
  echo  Ban KHONG the chi gui rieng file .bat.
  echo  Hay copy CA THU MUC BLaoBarber ^(hoac file .zip da dong goi^).
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0dist\index.html" (
  echo  [LOI] Thieu thu muc dist\
  echo  Nguoi lap trinh can chay: npm run build  hoac  npm run package:win
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0server\index.ts" (
  echo  [LOI] Thieu thu muc server\
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\tsx" (
  echo  [LOI] Chua co thu muc node_modules\
  echo  Trong thu muc nay chay: npm install
  echo  Hoac dung ban release da dong goi san ^(npm run package:win^).
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  if exist "%~dp0runtime\node\node.exe" (
    set "PATH=%~dp0runtime\node;%PATH%"
  ) else (
    echo  [LOI] Chua tim thay Node.js.
    echo  Cai Node.js 22 tro len: https://nodejs.org
    echo  Hoac giai nen node.exe vao: runtime\node\
    echo.
    pause
    exit /b 1
  )
)

node scripts\launch.mjs
if errorlevel 1 pause

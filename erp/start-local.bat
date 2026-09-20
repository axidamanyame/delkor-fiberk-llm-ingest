@echo off
cd /d "%~dp0"
title Delkor-Fiberk ERP (local)
echo.
echo  Freeing port 5500 if an old copy is still running...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5500" ^| findstr "LISTENING"') do taskkill /F /PID %%P >nul 2>&1
echo.
echo  Starting local ERP on http://127.0.0.1:5500/login.html
echo  Leave this window open. Sign in with your HQ account.
echo.
where node >nul 2>&1 (
  start "" "http://127.0.0.1:5500/login.html"
  node start-local.mjs
  goto :end
)
where py >nul 2>&1 (
  start "" "http://127.0.0.1:5500/login.html"
  py -m http.server 5500 --bind 127.0.0.1
  goto :end
)
where python >nul 2>&1 (
  start "" "http://127.0.0.1:5500/login.html"
  python -m http.server 5500 --bind 127.0.0.1
  goto :end
)
echo  Need Node.js (https://nodejs.org) or Python, then double-click this file again.
pause
:end

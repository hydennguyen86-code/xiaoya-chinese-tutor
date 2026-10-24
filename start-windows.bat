@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chưa có Node.js. Cài Node 24 từ https://nodejs.org/ rồi mở lại file này.
  echo Hướng dẫn: https://github.com/hydennguyen86-code/xiaoya-chinese-tutor#readme
  pause
  exit /b 1
)
node scripts\start.mjs
pause

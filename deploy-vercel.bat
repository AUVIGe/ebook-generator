@echo off
chcp 65001 >nul
echo ============================================
echo   📚 一键电子书 - Vercel 一键部署
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ 未检测到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)

where vercel >nul 2>nul
if %errorlevel% neq 0 (
  echo 📦 正在安装 Vercel CLI...
  call npm i -g vercel
)

echo 🚀 开始部署...
echo.
echo   提示：
echo   1. 第一次会要求登录 Vercel（用 GitHub/邮箱都行）
echo   2. 项目名随便填（如 ebook-generator）
echo   3. 部署完成后会给你一个 https://xxx.vercel.app 域名
echo.
echo ============================================
echo.

call vercel --prod
pause

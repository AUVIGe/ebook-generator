@echo off
chcp 65001 >nul
echo 🚀 启动一键电子书生成器...
echo 📍 浏览器请打开: http://localhost:8000
echo 🛑 关闭服务请按 Ctrl + C
echo.
start "" "http://localhost:8000"
python -m http.server 8000
pause

#!/bin/bash
# 一键电子书生成器 - Mac 一键启动
cd "$(dirname "$0")"
echo "🚀 启动一键电子书生成器..."
echo "📍 浏览器请打开: http://localhost:8000"
echo "🛑 关闭服务请按 Ctrl + C"
echo ""
open "http://localhost:8000" 2>/dev/null
python3 -m http.server 8000

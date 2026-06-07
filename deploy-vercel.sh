#!/bin/bash
# Vercel 一键部署脚本 (Mac/Linux)
# 用法：bash deploy-vercel.sh
echo "============================================"
echo "  📚 一键电子书 - Vercel 一键部署"
echo "============================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ 未检测到 Node.js，请先安装：https://nodejs.org/"
  exit 1
fi

# 检查 vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "📦 正在安装 Vercel CLI..."
  npm i -g vercel
fi

echo "🚀 开始部署..."
echo ""
echo "  提示："
echo "  1. 第一次会要求登录 Vercel（用 GitHub/邮箱都行）"
echo "  2. 项目名随便填（如 ebook-generator）"
echo "  3. 部署完成后会给你一个 https://xxx.vercel.app 域名"
echo ""
echo "============================================"
echo ""

vercel --prod

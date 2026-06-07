#!/bin/bash
# 推送到 GitHub 脚本
# 用法：把下面的 YOUR_TOKEN 替换成你的 GitHub Personal Access Token，然后运行
# bash push-to-github.sh

TOKEN="YOUR_TOKEN"  # 👈 替换为你的 GitHub PAT

if [ "$TOKEN" = "YOUR_TOKEN" ]; then
  echo "❌ 请先编辑本文件，把 YOUR_TOKEN 替换成你的 GitHub Personal Access Token"
  echo ""
  echo "获取 PAT 步骤："
  echo "  1. 打开 https://github.com/settings/tokens/new"
  echo "  2. Note 填 'ebook-generator-push'"
  echo "  3. Expiration 选 7 days 或 No expiration"
  echo "  4. Scopes 勾选 'repo'"
  echo "  5. 点 Generate token，复制 token 字符串"
  echo "  6. 把本脚本的 YOUR_TOKEN 替换为你的 token"
  exit 1
fi

cd "$(dirname "$0")"

echo "🔐 配置 Git 凭证..."
git config user.email "AUVIGe@users.noreply.github.com"
git config user.name "AUVIGe"

echo "📡 设置远程（用 token 认证）..."
git remote set-url origin "https://${TOKEN}@github.com/AUVIGe/ebook-generator.git"

echo "🚀 推送到 main 分支..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 推送成功！"
  echo "🌐 访问：https://github.com/AUVIGe/ebook-generator"
  # 清理：移除 token URL
  git remote set-url origin "https://github.com/AUVIGe/ebook-generator.git"
  echo "🔒 已清理 token URL"
else
  echo "❌ 推送失败，请检查 token 是否正确"
  exit 1
fi

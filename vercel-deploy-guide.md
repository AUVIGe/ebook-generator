# Vercel 部署快速指南

## 最简配置（推荐）
项目根目录的 `vercel.json`：
```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

或者**完全删除 `vercel.json`**，Vercel 会自动识别静态站。

## 目录结构必须这样
```
ebook-generator/
├── index.html          ← 必须根目录
├── script.js
├── style.css
├── lib/
│   └── *.js
├── vercel.json         ← 可选
└── README.md
```

## ❌ 错误 404: NOT_FOUND 的常见原因
1. `vercel.json` 用 `builds` 字段但没正确配置 → 改用上面最简配置
2. 根目录没有 `index.html` → 检查根目录
3. 文件没上传完整 → 重新部署

## ✅ 部署步骤（重新部署）
1. Vercel 项目页 → Settings → 删除当前 Build & Development Settings
2. 删除 `vercel.json` 或保持最简
3. Deployments → 最新部署右边 "..." → Redeploy
4. 等 30 秒

## 🔍 如何调试
访问 Vercel 项目页 → Deployments → 点最新一次 → 看 Build Logs
- "Build successful" 表示构建成功
- 404 是运行时错误（找不到文件）

常见修复：
```json
// vercel.json (最简版)
{
  "cleanUrls": true
}
```

如果还有 404，**完全删除 vercel.json**（Vercel 会用默认配置）。

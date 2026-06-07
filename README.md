# 📚 一键电子书生成器 (Ebook Generator)

> 一键上传文档（PDF/Word/TXT/EPUB/MD），自动排版为适合手机阅读的 9:16 电子书，生成带二维码的分享海报。

## ✨ 主要功能

- 📄 **多格式支持**：PDF、Word（doc/docx）、TXT、EPUB、Markdown
- 🎨 **封面生成**：
  - AI 智能生成（基于文档主题自动绘制）
  - 用户上传本地图片
- 📖 **手机适配排版**：自动识别章节，生成目录
- 🔍 **阅读体验优化**：
  - 9:16 竖屏布局
  - 上一节 / 下一节 快速翻页
  - 字号大小调节
  - 白天 / 护眼 / 夜晚 三种配色
  - 紧凑 / 标准 / 宽松 三种行距
- 🔗 **一键发布**：
  - 内容压缩后存入 URL hash，扫码即读
  - 超长内容自动生成独立 HTML 文件
  - 海报含 720×1280 PNG + 真实可扫二维码
- 📱 **PC + H5 完美自适应**
- 🔒 **完全前端，零后端**，可部署到任意静态托管

## 🚀 快速开始

### 本地运行（最简单）

**Mac**：
```bash
双击启动.command
```

**Windows**：
```cmd
双击启动.bat
```

浏览器会自动打开 `http://localhost:8000`。

### 部署到 Vercel（5 分钟，免费）

1. 注册 [Vercel](https://vercel.com)（GitHub 账号即可）
2. 在本目录下运行：
   ```bash
   npm i -g vercel
   vercel --prod
   ```
3. 或直接拖拽整个文件夹到 https://vercel.com/new

详见 `Vercel部署-5分钟教程.md`。

### 部署到其他平台

参见 `自部署教程.md`，支持：
- Vercel / Netlify / CloudFlare Pages
- 腾讯云开发 / 阿里云 OSS
- GitHub Pages / Gitee Pages
- 自建服务器（Nginx）

## 📂 文件结构

```
ebook-generator/
├── index.html                    # 主页面
├── script.js                     # 核心逻辑
├── style.css                     # 样式
├── vercel.json                   # Vercel 部署配置
├── lib/                          # 第三方库（本地，离线可用）
│   ├── mammoth.min.js           # Word 解析
│   ├── pdf.min.js               # PDF 解析
│   ├── pdf.worker.min.js        # PDF worker
│   ├── qrcode.min.js            # QR 码生成
│   └── lz-string.min.js         # 数据压缩
├── README.md                     # 本文件
├── Vercel部署-5分钟教程.md       # Vercel 一键部署
├── 自部署教程.md                 # 多平台部署方案
├── 启动教程.md                   # 本地使用教程
├── deploy-vercel.sh              # Mac/Linux 部署脚本
├── deploy-vercel.bat             # Windows 部署脚本
├── 双击启动.command              # Mac 本地启动
└── 双击启动.bat                  # Windows 本地启动
```

## 🛠 技术栈

- **文档解析**：[pdf.js](https://mozilla.github.io/pdf.js/) + [mammoth.js](https://github.com/mwilliamson/mammoth.js)
- **数据压缩**：[lz-string](https://github.com/pieroxy/lz-string)
- **二维码**：[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (本地) + [quickchart.io](https://quickchart.io/) (远程 fallback)
- **路由**：原生 hash 路由 + query string 双模式
- **样式**：纯 CSS（无 Tailwind / Bootstrap）

## 🎯 浏览器兼容性

- ✅ Chrome / Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ 移动端浏览器（iOS Safari / Android Chrome）
- ⚠️ IE 不支持

## 📄 License

MIT License - 自由使用、修改、分发

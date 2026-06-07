# 🚀 5 分钟部署到 Vercel（最简单方案）

## 准备工作：注册 Vercel
1. 打开 https://vercel.com/signup
2. 用 GitHub 账号或邮箱注册（推荐 GitHub，登录更快）
3. 不用绑定信用卡，**完全免费**

---

## 🚀 方法 A：一键脚本部署（推荐，3 分钟）

### Mac / Linux 用户：
```bash
# 1. 解压本 zip
# 2. 打开终端，进入文件夹
cd 路径/到/ebook-generator

# 3. 运行一键部署
bash deploy-vercel.sh
```

### Windows 用户：
1. 解压 zip
2. 双击 `deploy-vercel.bat`
3. 按提示操作

### 部署时的交互：
```
? Set up and deploy? → 输 Y + 回车
? Which scope do you want to deploy to? → 选你的账号
? Link to existing project? → 输 N
? What's your project's name? → ebook-generator（任意名字）
? In which directory is your code located? → 直接回车
? Want to modify these settings? → 输 N
```

部署完成后会显示：
```
✅ Production: https://ebook-generator-xxx.vercel.app [copied to clipboard]
```

**这就是你的网站地址！** 🎉

---

## 🌐 方法 B：网页拖拽部署（最最简单，2 分钟）

不用命令行，直接网页操作：

1. 打开 https://vercel.com/new
2. 选 "Browse" 或拖拽整个 `ebook-generator` 文件夹
3. 项目名填 `ebook-generator`
4. 点击 "Deploy"
5. 等待 30 秒，部署完成

---

## 🎉 部署完成后

1. 打开你的 Vercel 域名：`https://ebook-generator-xxx.vercel.app`
2. 上传一个文档测试
3. 生成海报，**微信扫码直接打开**（Vercel 域名是微信白名单）

---

## 💎 加分项：绑定自己的域名

如果你有自己的域名（比如 `ebook.yourdomain.com`）：

1. 在 Vercel 项目页 → Settings → Domains
2. 输入你的子域名
3. 按提示在你的域名 DNS 服务商添加 CNAME 记录
4. Vercel 自动签发 SSL 证书

---

## 🆘 常见问题

**Q: 部署失败？**
A: 检查 Node.js 版本（需 14+），重新运行 `bash deploy-vercel.sh`

**Q: 微信扫码还是拦截？**
A: Vercel 域名（`.vercel.app`）是微信白名单，正常不会拦截。如有问题，看是否微信版本需要更新

**Q: 部署后能改东西吗？**
A: 改完代码再运行 `vercel --prod` 即可

**Q: 部署后想绑定自己域名？**
A: 见上面的"加分项"

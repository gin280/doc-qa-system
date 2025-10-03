# ⚡ Vercel 部署指南

## 📋 概述

本文档介绍如何将应用部署到 Vercel 生产环境。

**前置条件**: 
- ✅ 已完成 [数据库配置](./1-database-setup.md)
- ✅ 已完成 [OAuth 配置](./2-oauth-setup.md)

**预计时间**: 10-15 分钟

---

## 🚀 方式一：使用 Vercel CLI（推荐）

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

选择登录方式（GitHub、GitLab、Bitbucket 或 Email）

### 3. 部署到预览环境

```bash
# 首次部署会提示配置项目
vercel
```

**首次部署提示**：
```
? Set up and deploy "~/doc-qa-system"? [Y/n] y
? Which scope do you want to deploy to? Your Name
? Link to existing project? [y/N] n
? What's your project's name? doc-qa-system
? In which directory is your code located? ./
```

### 4. 配置环境变量

在 Vercel CLI 部署过程中，或通过命令添加：

```bash
# 添加生产环境变量
vercel env add NEXTAUTH_SECRET production
vercel env add DATABASE_URL production
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add GITHUB_CLIENT_ID production
vercel env add GITHUB_CLIENT_SECRET production
```

### 5. 部署到生产环境

```bash
vercel --prod
```

**预期输出**：
```
✔ Production: https://doc-qa-system.vercel.app [copied to clipboard]
```

---

## 🖥️ 方式二：使用 Vercel Dashboard

### 1. 推送代码到 GitHub

确保代码已推送到 GitHub：

```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. 导入项目

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New..."** → **"Project"**
3. 选择你的 GitHub 仓库 `doc-qa-system`
4. 点击 **"Import"**

### 3. 配置项目设置

Vercel 会自动检测到 Next.js 项目，默认配置通常正确：

| 配置项 | 值 |
|--------|-----|
| **Framework Preset** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x 或更高 |

### 4. 配置环境变量

在 **"Environment Variables"** 部分添加所有必需的环境变量：

#### 必需的环境变量

```env
# NextAuth 配置
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=<使用 openssl rand -base64 32 生成>

# 数据库
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Google OAuth（如果启用）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth（如果启用）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Supabase 公共配置
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**⚠️ 重要提示**：
1. 所有环境变量选择 **"Production"** 环境
2. 敏感信息（如 SECRET, PASSWORD）不要暴露在前端代码中
3. `NEXT_PUBLIC_*` 开头的变量会被打包到前端代码

#### 生成 NEXTAUTH_SECRET

```bash
# 方法 1: 使用 openssl
openssl rand -base64 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. 部署

配置完成后，点击 **"Deploy"** 按钮。

**部署过程**（约 2-3 分钟）：
1. ✅ 安装依赖
2. ✅ TypeScript 编译
3. ✅ Next.js 构建
4. ✅ 优化和压缩
5. ✅ 部署到 CDN

---

## ✅ 验证部署

### 1. 访问部署的应用

部署成功后，Vercel 会提供 URL：

- **预览环境**: `https://doc-qa-system-git-branch-name.vercel.app`
- **生产环境**: `https://doc-qa-system.vercel.app`

### 2. 验证检查清单

访问应用并检查：

- [ ] **首页加载**: 正常显示首页
- [ ] **样式渲染**: CSS 和 Tailwind 样式正确
- [ ] **路由导航**: 登录、注册页面可访问
- [ ] **OAuth 登录**: Google/GitHub 登录流程正常
- [ ] **数据库连接**: 注册/登录功能正常
- [ ] **环境变量**: 检查 Network 标签确认 API 调用正常
- [ ] **错误处理**: 测试错误场景（如错误密码）

### 3. 检查部署日志

在 Vercel Dashboard 中：
1. 进入项目 → **Deployments**
2. 点击最新的部署
3. 查看 **Build Logs** 和 **Function Logs**

### 4. 测试关键功能

**用户注册流程**:
```
1. 访问 /register
2. 填写邮箱和密码
3. 提交表单
4. 验证自动登录到 Dashboard
```

**OAuth 登录流程**:
```
1. 访问 /login
2. 点击 "使用 Google 登录"
3. 完成 OAuth 授权
4. 验证返回并登录成功
```

**Dashboard 访问**:
```
1. 访问 /dashboard（需要登录）
2. 验证显示用户信息
3. 测试退出登录功能
```

---

## 🔄 自动部署

### Git 分支自动部署

Vercel 会自动为不同分支创建部署：

| 分支类型 | 部署环境 | URL 格式 |
|---------|---------|----------|
| `main` | Production | `https://doc-qa-system.vercel.app` |
| `dev`, `feature/*` | Preview | `https://doc-qa-system-git-[branch].vercel.app` |
| Pull Request | Preview | `https://doc-qa-system-[pr-number].vercel.app` |

### 触发条件

**自动触发部署**：
- ✅ Push 到 `main` 分支 → 生产部署
- ✅ Push 到其他分支 → 预览部署
- ✅ 创建/更新 Pull Request → PR 预览部署

**手动触发部署**：
```bash
# 通过 CLI
vercel --prod

# 或在 Vercel Dashboard
# 点击 "Redeploy" 按钮
```

---

## 🌐 自定义域名

### 1. 添加域名

1. 在 Vercel 项目设置中点击 **"Domains"**
2. 点击 **"Add"**
3. 输入你的域名（如 `example.com`）
4. 点击 **"Add"**

### 2. 配置 DNS

Vercel 会提供 DNS 配置说明。在你的域名提供商处添加：

**方式 A: CNAME 记录**（推荐）
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**方式 B: A 记录**
```
Type: A
Name: @
Value: 76.76.21.21
```

### 3. 更新环境变量

添加域名后，更新 `NEXTAUTH_URL`：

```env
NEXTAUTH_URL=https://your-custom-domain.com
```

### 4. 更新 OAuth 回调 URL

在 Google/GitHub OAuth 应用配置中，添加新的回调 URL：

```
https://your-custom-domain.com/api/auth/callback/google
https://your-custom-domain.com/api/auth/callback/github
```

---

## 🚨 故障排查

### 构建失败

#### 错误: "Build failed"

**可能原因**：
- TypeScript 编译错误
- 依赖安装失败
- 环境变量缺失

**解决方法**：
1. **本地构建测试**：
   ```bash
   npm run build
   ```
2. **检查 TypeScript 错误**：
   ```bash
   npm run type-check
   ```
3. **验证依赖**：
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

#### 错误: "Module not found"

**原因**: 导入路径错误或依赖缺失

**解决方法**：
1. 检查导入路径大小写（Linux 区分大小写）
2. 确认依赖在 `package.json` 中
3. 使用相对路径而非别名（或配置 `tsconfig.json`）

### 运行时错误

#### 错误: "Internal Server Error"

**原因**: 服务器端代码执行失败

**解决方法**：
1. 查看 Vercel Function Logs：
   - Dashboard → Deployments → 选择部署 → Functions
2. 检查环境变量配置
3. 验证数据库连接
4. 检查 API 路由代码

#### 错误: "Cannot connect to database"

**原因**: 数据库连接配置错误

**解决方法**：
1. 验证 `DATABASE_URL` 在 Vercel 中配置正确
2. 确认数据库允许 Vercel IP 访问
3. 测试连接字符串格式
4. 检查 Supabase 项目状态

### OAuth 错误

#### 错误: "Configuration Error"

**原因**: OAuth 配置不正确

**解决方法**：
1. 验证 `NEXTAUTH_URL` 与实际域名匹配
2. 检查 OAuth 回调 URL 是否正确添加
3. 确认 Client ID 和 Secret 正确配置
4. 运行验证脚本：
   ```bash
   npm run verify:oauth
   ```

#### 错误: "Access Denied"

**原因**: OAuth 授权失败

**解决方法**：
1. 检查用户是否取消授权
2. 验证 OAuth 应用状态（未暂停）
3. 查看服务器日志获取详细错误

### 性能问题

#### 页面加载慢

**优化方法**：
1. **启用 ISR**（Incremental Static Regeneration）
2. **优化图片**: 使用 Next.js `<Image>` 组件
3. **代码分割**: 使用动态导入 `dynamic()`
4. **CDN 缓存**: Vercel 自动处理

#### API 响应慢

**优化方法**：
1. 添加数据库查询索引
2. 使用连接池
3. 实施缓存策略（Redis）
4. 监控慢查询

---

## 📊 监控与日志

### Vercel Analytics

启用 Vercel Analytics 监控：

1. Dashboard → Project → **Analytics**
2. 查看指标：
   - **Web Vitals**: LCP, FID, CLS
   - **页面访问量**
   - **加载时间分布**

### Function Logs

查看服务器端日志：

1. Dashboard → Deployments → 选择部署
2. 点击 **Functions** 标签
3. 查看实时日志和错误

### 推荐监控指标

| 指标 | 目标值 | 监控位置 |
|------|--------|---------|
| **首页加载时间** | < 2s | Vercel Analytics |
| **API 响应时间** | < 500ms | Function Logs |
| **构建时间** | < 3min | Deployment Logs |
| **错误率** | < 0.1% | Function Logs |
| **OAuth 成功率** | > 95% | Application Logs |

---

## 🔒 生产环境最佳实践

### 安全配置

1. **环境变量隔离**
   - ✅ 使用 Vercel Dashboard 配置生产环境变量
   - ❌ 不要在代码中硬编码敏感信息
   - ❌ 不要将 `.env` 文件提交到 Git

2. **HTTPS 强制**
   - ✅ Vercel 自动启用 HTTPS
   - ✅ `NEXTAUTH_URL` 使用 `https://`

3. **OAuth 回调 URL 限制**
   - ✅ 仅添加生产域名
   - ❌ 不添加通配符或 localhost

### 性能优化

1. **启用缓存**
   ```typescript
   // 在 API 路由中
   export const revalidate = 60; // ISR 每60秒重新验证
   ```

2. **优化图片**
   ```tsx
   import Image from 'next/image'
   
   <Image 
     src="/hero.jpg" 
     width={800} 
     height={600} 
     alt="Hero" 
   />
   ```

3. **代码分割**
   ```typescript
   import dynamic from 'next/dynamic'
   
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <p>Loading...</p>
   })
   ```

### 部署策略

1. **使用 Preview 部署测试**
   - 先部署到分支进行测试
   - 确认无误后合并到 `main`

2. **渐进式发布**
   - 使用 Vercel 的流量分配功能
   - 逐步增加新版本流量比例

3. **回滚计划**
   - Vercel 支持即时回滚到之前的部署
   - 在 Deployments 页面点击 "Promote to Production"

---

## 📚 相关文档

- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Vercel CLI 参考](https://vercel.com/docs/cli)
- [上一步: OAuth 配置](./2-oauth-setup.md)
- [部署总览](./README.md)

---

## 🔄 部署后检查清单

完成部署后，验证以下所有项：

### 功能验证
- [ ] 首页正常加载
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] OAuth 第三方登录正常
- [ ] Dashboard 访问权限正确
- [ ] 退出登录功能正常

### 安全验证
- [ ] HTTPS 强制启用
- [ ] OAuth 回调 URL 仅限生产域名
- [ ] 环境变量未暴露在客户端代码
- [ ] 敏感信息未泄露在日志中

### 性能验证
- [ ] 首屏加载 < 3秒
- [ ] API 响应 < 1秒
- [ ] 图片优化加载
- [ ] 无明显性能警告

### 监控设置
- [ ] Vercel Analytics 已启用
- [ ] 错误日志正常记录
- [ ] 关键 API 监控配置

---

**最后更新**: 2025-01-03  
**维护者**: Product Owner (Sarah)


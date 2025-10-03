# Vercel 部署指南

## 方式一：通过 Vercel CLI 部署

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

### 3. 部署到预览环境

```bash
vercel
```

### 4. 部署到生产环境

```bash
vercel --prod
```

## 方式二：通过 Vercel Dashboard 部署

### 1. 推送代码到 GitHub

```bash
git push origin main
```

### 2. 导入项目

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库 `doc-qa-system`
4. 配置项目设置：
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
# 如果有数据库等服务，在此配置
DATABASE_URL=your_database_url
NEXTAUTH_SECRET=your_secret_key
# ... 其他环境变量
```

### 4. 部署

点击 "Deploy" 按钮开始部署。

## 验证部署

部署成功后，Vercel 会提供一个 URL，例如：
- 预览环境: `https://doc-qa-system-xxx.vercel.app`
- 生产环境: `https://doc-qa-system.vercel.app`

访问该 URL 验证应用是否正常运行。

## 自动部署

配置完成后，每次推送到 `main` 分支都会自动触发生产环境部署。

## 自定义域名

1. 在 Vercel 项目设置中点击 "Domains"
2. 添加你的自定义域名
3. 按照提示配置 DNS 记录

## 故障排查

### 构建失败

检查构建日志，确保：
- 所有依赖都已正确安装
- TypeScript 编译无错误
- 环境变量配置正确

### 运行时错误

查看 Vercel 函数日志：
1. 访问项目 Dashboard
2. 点击 "Functions"
3. 查看错误日志


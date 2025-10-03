# Vercel 部署指南

## 快速部署步骤

### 方法 1: 使用 Vercel CLI (推荐)

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署到生产环境
vercel --prod
```

### 方法 2: 使用 Vercel Dashboard

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "Import Project"
3. 连接 GitHub 仓库
4. 选择 `doc-qa-system` 仓库
5. 配置环境变量（见下方）
6. 点击 "Deploy"

## 环境变量配置

在 Vercel Dashboard 中配置以下环境变量：

```
DATABASE_URL=your_database_url
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 生成 NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

## 部署后验证

1. 访问部署的 URL
2. 确认首页正常加载
3. 检查 Network 标签确认 200 状态码
4. 验证环境变量配置正确

## 注意事项

- 首次部署后，Vercel 会自动为每次 push 创建预览部署
- 生产部署仅在 main 分支更新时触发
- 确保所有环境变量在 Vercel Dashboard 中正确配置


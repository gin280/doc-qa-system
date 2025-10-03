# 🚀 部署文档总览

## 📋 部署前检查清单

在部署到生产环境前，请按顺序完成以下步骤：

- [ ] **步骤 1**: [配置数据库](./1-database-setup.md) (15分钟)
- [ ] **步骤 2**: [配置 OAuth 第三方登录](./2-oauth-setup.md) (20分钟) 
- [ ] **步骤 3**: [部署到 Vercel](./3-vercel-deployment.md) (10分钟)

**总时间**: 约 45 分钟

---

## 📚 文档导航

### [1. 数据库设置](./1-database-setup.md)
**目标**: 配置 PostgreSQL 数据库并执行迁移

**内容**:
- ✅ Supabase 项目创建
- ✅ 数据库连接配置
- ✅ Schema 迁移执行
- ✅ 数据库验证测试

**环境变量**:
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

### [2. OAuth 配置](./2-oauth-setup.md)
**目标**: 配置 Google/GitHub 第三方登录

**内容**:
- ✅ Google OAuth 应用配置
- ✅ GitHub OAuth 应用配置
- ✅ 回调 URL 安全配置
- ✅ 安全审计检查清单

**环境变量**:
```env
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<生成的密钥>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

**⚠️ 安全警告**: 
- QA-SEC-001: 必须严格限制 OAuth 回调 URL 白名单
- 详见文档中的安全配置章节

---

### [3. Vercel 部署](./3-vercel-deployment.md)
**目标**: 将应用部署到 Vercel 生产环境

**内容**:
- ✅ Vercel CLI 部署
- ✅ Vercel Dashboard 部署
- ✅ 环境变量配置
- ✅ 域名配置
- ✅ 部署验证
- ✅ 故障排查

---

## 🎯 快速参考

### 生成 NEXTAUTH_SECRET
```bash
# 方法 1: 使用 openssl
openssl rand -base64 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 验证配置
```bash
# 运行 OAuth 配置验证
npm run verify:oauth

# 运行完整部署前检查
npm run predeploy
```

### 常用命令
```bash
# 数据库
npm run db:push        # 推送 Schema 到数据库
npm run db:migrate     # 执行迁移文件
npm run db:studio      # 打开数据库可视化工具

# 部署
npm run build          # 本地构建验证
vercel                 # 部署到预览环境
vercel --prod          # 部署到生产环境
```

---

## 🔒 安全最佳实践

### 必须执行的安全措施

1. **OAuth 回调 URL 限制**
   - ✅ 仅添加生产域名
   - ❌ 不添加 localhost
   - ❌ 不使用通配符

2. **密钥强度要求**
   - NEXTAUTH_SECRET: 至少 32 字符
   - 数据库密码: 强密码 (大小写+数字+特殊字符)

3. **环境变量隔离**
   - 开发环境: `.env.local`
   - 生产环境: Vercel Dashboard 配置
   - ❌ 不要将 `.env.local` 提交到代码库

4. **HTTPS 强制**
   - 生产环境必须使用 HTTPS
   - NEXTAUTH_URL 必须是 `https://`

---

## 🚨 常见错误与解决

### 数据库连接失败
```
错误: Could not connect to database
```
**解决**:
1. 检查 DATABASE_URL 格式
2. 验证数据库密码正确
3. 确认 Supabase 项目正在运行

### OAuth 配置错误
```
错误: Configuration Error / Access Denied
```
**解决**:
1. 检查回调 URL 是否添加到 OAuth 应用
2. 验证 NEXTAUTH_URL 与实际域名匹配
3. 运行 `npm run verify:oauth` 检查配置

### Vercel 构建失败
```
错误: Build failed
```
**解决**:
1. 本地运行 `npm run build` 测试
2. 检查 TypeScript 编译错误
3. 验证环境变量在 Vercel 中配置正确

---

## 📊 部署后监控

### 建议监控的指标

1. **应用健康**
   - 首页加载时间
   - API 响应时间
   - 错误率

2. **OAuth 流程**
   - OAuth 登录成功率
   - 回调失败率
   - 授权响应时间

3. **数据库性能**
   - 查询响应时间
   - 连接池使用率
   - 慢查询数量

---

## 📚 相关文档

- [项目快速开始](../../QUICK_START.md)
- [用户故事索引](../prd/epic-story-index.md)
- [QA 质量门禁](../qa/gates/)
- [决策记录](../decisions/)

---

## 🔄 定期维护

### 每月任务
- [ ] 检查依赖更新（特别是安全补丁）
- [ ] 审查异常登录日志
- [ ] 验证数据库备份正常

### 每季度任务
- [ ] 轮换 OAuth Client Secret
- [ ] 安全审计检查
- [ ] 更新 NextAuth.js 到最新版本

---

**最后更新**: 2025-01-03  
**维护者**: Product Owner (Sarah)


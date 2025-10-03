# OAuth 第三方登录部署指南

## 📋 概述

本文档提供 OAuth 第三方登录功能的生产部署配置指南，解决 **QA-SEC-001** 安全问题。

## 🔐 安全要求（必读）

### ⚠️ 关键安全风险

**QA-SEC-001 (High)**: OAuth 回调 URL 劫持风险
- **问题**: 如果不限制回调 URL，攻击者可以将授权码重定向到恶意网站
- **影响**: 用户账户可能被劫持
- **解决**: 在 OAuth 应用配置中严格限制回调 URL 白名单

## 📝 部署前检查清单

在部署到生产环境前，**必须**完成以下所有步骤：

### 1. 环境变量配置

在部署平台（如 Vercel）配置以下环境变量：

```bash
# NextAuth 基础配置
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<随机生成的32字符以上强密钥>

# 数据库配置
DATABASE_URL=postgresql://user:password@host:5432/database

# Google OAuth（可选）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### 生成 NEXTAUTH_SECRET

```bash
# 方法 1: 使用 openssl
openssl rand -base64 32

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Google OAuth 应用配置（如果使用）

1. **登录 Google Cloud Console**
   - 访问: https://console.cloud.google.com/

2. **选择或创建项目**
   - 项目名称建议: "DocQA System Production"

3. **配置 OAuth 同意屏幕**
   - APIs & Services → OAuth consent screen
   - User Type: External（外部用户）
   - 填写应用信息（名称、邮箱、Logo等）

4. **创建 OAuth 2.0 凭据**
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: "DocQA Production"

5. **⚠️ 关键步骤：配置授权重定向 URI**
   ```
   仅添加生产域名：
   https://your-domain.com/api/auth/callback/google
   
   ❌ 不要添加 localhost
   ❌ 不要添加通配符
   ❌ 不要添加多个域名（除非确实需要）
   ```

6. **获取凭据**
   - 复制 Client ID 到 `GOOGLE_CLIENT_ID`
   - 复制 Client Secret 到 `GOOGLE_CLIENT_SECRET`

### 3. GitHub OAuth 应用配置（如果使用）

1. **登录 GitHub**
   - 访问: https://github.com/settings/developers

2. **创建 OAuth App**
   - Settings → Developer settings → OAuth Apps → New OAuth App

3. **填写应用信息**
   - Application name: "DocQA System"
   - Homepage URL: `https://your-domain.com`
   
4. **⚠️ 关键步骤：配置 Authorization callback URL**
   ```
   仅添加生产域名：
   https://your-domain.com/api/auth/callback/github
   
   ❌ 不要添加 localhost
   ❌ 不要使用通配符
   ```

5. **获取凭据**
   - 复制 Client ID 到 `GITHUB_CLIENT_ID`
   - Generate a new client secret → 复制到 `GITHUB_CLIENT_SECRET`

### 4. 运行配置验证脚本

在部署前运行自动化验证：

```bash
# 验证 OAuth 配置
npm run verify:oauth

# 完整部署前检查（验证 + 构建 + 测试）
npm run predeploy
```

脚本会检查：
- ✅ NEXTAUTH_URL 是否设置且使用 HTTPS
- ✅ NEXTAUTH_SECRET 是否足够强（至少32字符）
- ✅ OAuth Provider 凭据是否配置
- ✅ 数据库连接配置是否正确

### 5. 手动功能测试

在生产环境上线后，**必须**手动测试以下场景：

#### Google OAuth 流程
- [ ] 点击"使用 Google 登录"按钮
- [ ] 成功跳转到 Google 授权页面
- [ ] 授权后成功返回并登录到 Dashboard
- [ ] 用户头像正确显示
- [ ] 取消授权时返回登录页并显示友好提示

#### GitHub OAuth 流程
- [ ] 点击"使用 GitHub 登录"按钮
- [ ] 成功跳转到 GitHub 授权页面
- [ ] 授权后成功返回并登录到 Dashboard
- [ ] 用户头像正确显示
- [ ] 取消授权时返回登录页并显示友好提示

#### 错误处理
- [ ] 测试网络错误时的行为
- [ ] 测试 OAuth Provider 返回错误时的提示
- [ ] 验证错误信息是用户友好的

### 6. 安全审计

完成部署后进行安全检查：

- [ ] 在 Google Cloud Console 验证回调 URL 只有生产域名
- [ ] 在 GitHub OAuth App 验证回调 URL 只有生产域名
- [ ] 确认 NEXTAUTH_SECRET 未出现在公开代码中
- [ ] 确认 OAuth Client Secret 未泄露
- [ ] 验证生产环境强制使用 HTTPS
- [ ] 检查 OAuth 流程日志，确认无异常行为

## 🔄 账户关联策略（QA-FEATURE-001）

### 当前实现

**自动关联策略**（已实施）:
- 相同邮箱允许使用多种登录方式（EMAIL、GOOGLE、GITHUB）
- 首次 OAuth 登录会创建新用户
- 已存在邮箱 OAuth 登录时自动关联（仅更新头像）

### 安全考虑

✅ **已实施的保护措施**:
- OAuth 用户只能更新头像，不能修改核心用户信息（email、密码等）
- 所有 OAuth Provider 都会验证邮箱所有权（Google/GitHub 保证）
- Session Token 使用 HTTP-Only Cookie 防止 XSS

⚠️ **未来优化建议**（MVP 后实现）:
- 在 Dashboard 显示用户的所有关联登录方式
- 允许用户手动解绑 OAuth 账户
- 添加主要登录方式切换功能
- 实施邮箱验证机制（防止未验证邮箱账户）

## 📊 监控与告警

### 建议监控指标

1. **OAuth 流程成功率**
   - 目标: > 90%
   - 监控: Google/GitHub OAuth 登录成功/失败比例

2. **OAuth 回调失败率**
   - 目标: < 1%
   - 监控: `/api/auth/callback/{provider}` 错误率

3. **OAuth 流程响应时间**
   - 目标: P95 < 500ms
   - 监控: 从点击 OAuth 按钮到成功登录的总时间

4. **异常授权行为**
   - 监控: 短时间内大量失败的 OAuth 请求（可能是攻击）
   - 触发阈值: 5分钟内 > 10次失败

### 日志记录

建议在生产环境启用以下日志：

```typescript
// 在 src/lib/auth.ts 的 signIn 回调中
console.log('[OAuth] Sign in attempt', { 
  provider: account?.provider, 
  email: user.email,
  timestamp: new Date().toISOString()
})
```

## 🚨 故障排查

### 常见问题

#### 1. OAuth 回调返回 "Configuration Error"

**可能原因**:
- 回调 URL 未添加到 OAuth 应用白名单
- NEXTAUTH_URL 配置错误

**解决方法**:
1. 检查 OAuth 应用配置中的回调 URL
2. 验证 NEXTAUTH_URL 与实际域名匹配
3. 运行 `npm run verify:oauth` 验证配置

#### 2. OAuth 登录后显示 "Access Denied"

**可能原因**:
- 用户取消了授权
- OAuth Provider 返回错误
- 数据库连接失败

**解决方法**:
1. 检查服务器日志中的具体错误
2. 验证数据库连接正常
3. 确认 OAuth Client ID/Secret 正确

#### 3. 头像不显示

**可能原因**:
- OAuth Provider 未返回头像 URL
- 头像 URL 失效或访问受限

**解决方法**:
- 已实施 fallback 机制（显示用户名首字母）
- 检查数据库中 `avatarUrl` 字段是否正确存储

## 📚 相关文档

- [NextAuth.js 官方文档](https://next-auth.js.org/)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Apps 文档](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Story 1.5: OAuth 第三方登录](../stories/1.5-oauth-third-party-login.md)
- [QA Gate: 1.5](../qa/gates/1.5-oauth-third-party-login.yml)

## 🔄 定期维护

建议每季度进行以下维护：

1. **OAuth Client Secret 轮换**
   - 生成新的 Client Secret
   - 更新环境变量
   - 测试 OAuth 流程正常

2. **安全审计**
   - 检查 OAuth 应用配置
   - 审查异常授权行为日志
   - 验证回调 URL 白名单未被篡改

3. **依赖更新**
   - 更新 NextAuth.js 到最新稳定版
   - 检查安全公告

---

**最后更新**: 2025-01-03  
**维护者**: Dev Team  
**QA 审核**: Quinn (Test Architect)


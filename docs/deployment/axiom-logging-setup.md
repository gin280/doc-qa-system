# Axiom 日志系统配置指南

本指南帮助你完成 Axiom 日志系统的完整配置，实现生产环境的日志监控。

---

## 📋 前置要求

- 有效的电子邮箱账号
- 访问 Vercel Project Settings 的权限
- 本地开发环境已配置 `.env.local`

---

## 1️⃣ 注册 Axiom 账号

### 步骤 1.1: 访问 Axiom 官网

1. 打开浏览器访问: https://axiom.co/
2. 点击右上角 **"Sign Up"** 按钮
3. 选择 **"Sign up with Email"** (或使用 GitHub/Google 账号)

### 步骤 1.2: 选择免费计划

1. 在计划选择页面，选择 **"Free"** 计划
   - ✅ **500GB/月** 日志摄入量
   - ✅ **30 天** 数据保留
   - ✅ **5 queries/秒** 并发查询
   - ✅ **1 个用户** (可邀请更多)

2. 确认选择，完成注册

### 步骤 1.3: 验证邮箱

1. 检查注册邮箱，点击验证链接
2. 验证成功后，登录 Axiom Dashboard

---

## 2️⃣ 创建 Dataset

### 步骤 2.1: 创建新 Dataset

1. 登录后，进入 **Datasets** 页面
2. 点击 **"New Dataset"** 按钮
3. 填写配置：
   - **Name**: `docqa-system`
   - **Description**: `Doc QA System Production Logs`
   - **Retention**: `30 days` (免费计划默认)

4. 点击 **"Create Dataset"** 完成创建

### 步骤 2.2: 记录 Dataset 信息

- Dataset Name: `docqa-system`
- Dataset URL: `https://cloud.axiom.co/<your-org>/datasets/docqa-system`

---

## 3️⃣ 生成 API Token

### 步骤 3.1: 创建 Ingest Token

1. 进入 **Settings** → **API Tokens**
2. 点击 **"New Token"** 按钮
3. 配置 Token:
   - **Name**: `docqa-system-ingest`
   - **Description**: `Token for DocQA system log ingestion`
   - **Permissions**: 选择 **"Ingest"** (写入日志权限)
   - **Datasets**: 选择 `docqa-system`

4. 点击 **"Create Token"**

### 步骤 3.2: 保存 Token

⚠️ **重要**: Token 只显示一次，请立即复制并保存到安全位置！

```bash
# 示例 Token 格式 (不要使用这个！)
xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 步骤 3.3: 记录 Organization ID

1. 在 Settings 页面找到 **Organization ID**
2. 复制并保存 (格式类似: `org-12345`)

---

## 4️⃣ 配置环境变量

### 步骤 4.1: 本地开发环境

编辑项目根目录的 `.env.local` 文件:

```bash
# Axiom 日志配置
AXIOM_DATASET=docqa-system
AXIOM_TOKEN=xaat-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # 替换为你的实际 Token
AXIOM_ORG_ID=org-12345                                  # 替换为你的实际 Org ID
LOG_LEVEL=info
```

**验证配置**:

```bash
# 启动开发服务器
npm run dev

# 检查日志输出，应该看到彩色的 pino-pretty 日志
```

### 步骤 4.2: Vercel 生产环境

1. 登录 Vercel Dashboard
2. 进入项目: **doc-qa-system**
3. 进入 **Settings** → **Environment Variables**

4. 添加以下变量 (所有环境: Production, Preview, Development):

| 变量名 | 值 | 类型 | 环境 |
|--------|-----|------|------|
| `AXIOM_DATASET` | `docqa-system` | Plain Text | All |
| `AXIOM_TOKEN` | `xaat-xxxx...` | **Secret** | All |
| `AXIOM_ORG_ID` | `org-12345` | Plain Text | All |
| `LOG_LEVEL` | `info` | Plain Text | Production, Preview |

⚠️ **重要**: 将 `AXIOM_TOKEN` 标记为 **Secret**！

5. 点击 **"Save"** 保存配置

### 步骤 4.3: 触发重新部署

环境变量更新后，需要重新部署:

```bash
# 方式 1: 在 Vercel Dashboard 中点击 "Redeploy"
# 方式 2: 推送新的 commit 触发自动部署
git commit --allow-empty -m "chore: trigger redeploy for Axiom config"
git push origin main
```

---

## 5️⃣ 验证日志发送

### 步骤 5.1: 测试本地环境

```bash
# 1. 设置生产模式环境变量
NODE_ENV=production npm run build
NODE_ENV=production npm start

# 2. 故意触发错误 (如上传无效文件)
# 3. 等待 1-2 分钟
```

### 步骤 5.2: 检查 Axiom Dashboard

1. 访问 Axiom Dashboard
2. 进入 **Datasets** → `docqa-system`
3. 切换到 **Stream** 视图 (实时日志流)
4. 应该看到最近 5 分钟内的错误日志

示例日志:

```json
{
  "level": 50,
  "time": "2025-01-15T10:00:00.000Z",
  "error": "Document upload failed",
  "userId": "user-123",
  "fileName": "test.pdf",
  "action": "upload_error"
}
```

### 步骤 5.3: 验证查询功能

运行测试查询:

```apl
# 查询最近 1 小时的错误日志
['level'] == 50 or ['level'] == 60
| where ['_time'] > ago(1h)
| limit 50
```

如果看到日志，说明配置成功！ 🎉

---

## 6️⃣ 配置 Dashboard 和告警

详细配置步骤请参考: [`axiom-operations-guide.md`](./axiom-operations-guide.md)

快速配置清单:

- [ ] 创建 4 个 Saved Queries (错误日志、上传日志、查询日志、缓存日志)
- [ ] 创建监控 Dashboard (5 个 Panels)
- [ ] 配置 3 个告警规则 (错误率、上传失败、配额告警)

---

## 🔍 故障排查

### 问题 1: 日志未发送到 Axiom

**可能原因**:
- ❌ `AXIOM_TOKEN` 未配置或错误
- ❌ `NODE_ENV` 不是 `production`
- ❌ 日志级别低于 `error` (MVP 策略只发送 error/fatal)

**解决方法**:
```bash
# 检查环境变量
echo $NODE_ENV          # 应该是 "production"
echo $AXIOM_TOKEN       # 应该有值 (不显示实际内容)

# 检查 logger 配置
node -e "const logger = require('./src/lib/logger'); console.log(logger)"
```

### 问题 2: Vercel 环境变量不生效

**解决方法**:
1. 确认环境变量已保存到 **All environments**
2. 触发重新部署 (环境变量更新后不会自动生效)
3. 检查 Vercel 部署日志，确认变量已加载

### 问题 3: Axiom Token 失效

**解决方法**:
1. 进入 Axiom Settings → API Tokens
2. 检查 Token 状态 (Active/Revoked)
3. 如果 Token 被吊销，创建新 Token 并更新环境变量

### 问题 4: 配额使用过快

**解决方法**:
1. 检查当前配额使用: Axiom Settings → Usage
2. 如果接近限制，考虑:
   - 提高日志过滤级别 (只发送 `fatal`)
   - 实施采样策略 (10% 的 info 日志)
   - 升级到付费计划

---

## 📊 配额监控

### 免费计划配额

- **月度摄入量**: 500GB
- **预估使用量** (MVP 阶段):
  - 100 errors/day × 30 days × 10KB/log ≈ **30MB/月**
  - 远低于 500GB 限制 ✅

### 配额告警设置

在 Axiom 中设置告警 (参考 operations guide):

```apl
# 告警条件: 月度使用 > 400GB (80%)
['_sysUsage'] > 400GB
```

---

## ✅ 配置完成检查清单

在继续之前，请确认:

- [ ] ✅ Axiom 账号已创建 (Free 计划)
- [ ] ✅ Dataset `docqa-system` 已创建
- [ ] ✅ API Token 已生成并保存
- [ ] ✅ Organization ID 已记录
- [ ] ✅ 本地 `.env.local` 已配置
- [ ] ✅ Vercel 环境变量已配置 (标记 Token 为 Secret)
- [ ] ✅ 重新部署已触发
- [ ] ✅ Axiom Dashboard 可以看到日志
- [ ] ✅ 测试查询可以返回结果

---

## 📚 下一步

1. **配置 Dashboard 和告警**: 参考 [`axiom-operations-guide.md`](./axiom-operations-guide.md)
2. **学习日志查询语言**: Axiom Docs - APL Query Language
3. **了解最佳实践**: [`docs/architecture/logging-guide.md`](../architecture/logging-guide.md)

---

## 🆘 获取帮助

- **Axiom 官方文档**: https://axiom.co/docs
- **Pino 文档**: https://getpino.io/
- **项目日志指南**: `docs/architecture/logging-guide.md`
- **QA 评估报告**: `docs/qa/assessments/4.12-*`

---

**最后更新**: 2025-01-15  
**维护者**: DevOps Team  
**Story**: 4.12 - Axiom 日志集成


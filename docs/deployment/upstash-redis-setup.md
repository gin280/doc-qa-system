# Upstash Redis 配置指南

## 概述

本指南说明如何为 Story 4.1（上传速率限制）配置 Upstash Redis 环境变量。

## 🚨 重要性

**没有配置 Redis 环境变量，速率限制功能将完全失效！**

- 代码会启动，但不会进行速率限制
- 每次上传都会触发降级逻辑
- 系统不受 DoS 攻击保护

## 快速配置步骤（5-10分钟）

### 1. 创建 Upstash Redis 数据库

1. 访问 [Upstash Console](https://console.upstash.com/)
2. 注册/登录账号（免费层足够）
3. 点击 "Create Database"
4. 配置：
   - **Name**: `doc-qa-ratelimit` （或其他名称）
   - **Region**: 选择离用户最近的区域（例如：`ap-southeast-1` 新加坡）
   - **Type**: `Regional`
   - **TLS**: ✅ Enable
5. 点击 "Create"

### 2. 获取 REST API 凭证

创建数据库后：

1. 在数据库详情页，切换到 **"REST API"** 标签
2. 复制以下信息：
   - **UPSTASH_REDIS_REST_URL**: 例如 `https://xxxxx.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: 长字符串令牌

### 3. 配置本地环境

#### 方法 A：使用 `.env.local` 文件（推荐）

在项目根目录创建或编辑 `.env.local` 文件：

```bash
# Upstash Redis for Rate Limiting (Story 4.1)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"
```

#### 方法 B：使用系统环境变量

```bash
# macOS/Linux
export UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"

# Windows (PowerShell)
$env:UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"
```

### 4. 验证配置

启动应用并验证：

```bash
# 启动开发服务器
npm run dev

# 检查日志，应该没有 Redis 警告
# ✅ 正确：无警告日志
# ❌ 错误：看到 "Upstash Redis requires a url and token" 警告
```

**测试速率限制**：

1. 登录应用
2. 连续上传 11 个文档
3. 第 11 次上传应该返回 **429 Too Many Requests**
4. 检查响应头：
   ```
   X-RateLimit-Limit: 10
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: <timestamp>
   Retry-After: <seconds>
   ```

## 生产部署配置

### Vercel 部署

1. 进入 Vercel 项目设置
2. 导航到 **"Settings" → "Environment Variables"**
3. 添加以下变量：
   - Key: `UPSTASH_REDIS_REST_URL`
   - Value: `https://your-redis-url.upstash.io`
   - Environments: ✅ Production, ✅ Preview
4. 添加第二个变量：
   - Key: `UPSTASH_REDIS_REST_TOKEN`
   - Value: `your-redis-token-here`
   - Environments: ✅ Production, ✅ Preview
5. 重新部署项目

### 其他平台

- **Docker**: 在 `docker-compose.yml` 或 Dockerfile 中添加环境变量
- **AWS/Azure/GCP**: 在各自的环境变量配置中添加
- **Kubernetes**: 在 ConfigMap 或 Secret 中配置

## 配置验证清单

- [ ] Upstash Redis 数据库已创建
- [ ] REST API 凭证已复制
- [ ] 本地 `.env.local` 文件已配置
- [ ] 应用启动无 Redis 警告
- [ ] 连续上传测试，第 11 次返回 429
- [ ] 生产环境变量已配置（如需部署）

## 监控和告警

配置后，建议设置以下监控（见 Story 4.1 门禁）：

- `rateLimitDegradation` 事件（Redis 故障）
- Redis 连接失败率
- 速率限制命中率

## 故障排查

### 问题：应用启动显示 Redis 警告

**症状**：
```
Upstash Redis requires a url and token
```

**解决**：
- 检查 `.env.local` 文件是否存在
- 验证环境变量名称拼写正确
- 确认令牌没有多余空格或引号

### 问题：速率限制不生效

**症状**：连续上传 11 次都成功，没有 429 响应

**诊断**：
1. 检查日志是否有 `rateLimitDegradation` 事件
2. 验证环境变量已加载：
   ```bash
   # 在代码中添加临时日志
   console.log('Redis URL configured:', !!process.env.UPSTASH_REDIS_REST_URL)
   ```
3. 确认 Redis 数据库状态正常（Upstash Console）

### 问题：降级模式频繁触发

**症状**：日志中频繁出现 `alert: 'rateLimitDegradation'`

**可能原因**：
- Redis 凭证错误
- Redis 数据库已删除
- 网络连接问题
- Redis 数据库区域太远（高延迟）

**解决**：
- 验证凭证正确
- 检查 Upstash Console 数据库状态
- 考虑使用更近的 Redis 区域

## 成本估算

**Upstash Free Tier**：
- 10,000 命令/天
- 256 MB 存储
- 适合小型项目和开发

**估算**：每次上传检查 = 1 个 Redis 命令
- 10 用户 × 100 上传/天 = 1,000 命令/天 ✅ 免费层足够
- 100 用户 × 100 上传/天 = 10,000 命令/天 ✅ 接近免费层限制
- 超出后：$0.2/100K 命令

## 相关文档

- [Story 4.1: 添加上传速率限制](../stories/4.1-upload-rate-limit.md)
- [Quality Gate: 4.1](../qa/gates/4.1-upload-rate-limit.yml)
- [Upstash Redis 文档](https://docs.upstash.com/redis)

---

**配置完成后**，请返回 Story 4.1 完成其他部署前检查项。




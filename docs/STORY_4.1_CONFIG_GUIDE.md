# Story 4.1 - 速率限制配置指南

**状态**：⚠️ **需要手动配置**  
**问题**：CONFIG-001 - Upstash Redis 环境变量未配置  
**影响**：速率限制功能完全失效（降级模式）

---

## 快速配置（5-10分钟）

### 步骤 1：创建 Upstash Redis 数据库

1. 访问 [Upstash Console](https://console.upstash.com/)
2. 注册/登录（免费层足够）
3. 点击 **"Create Database"**
4. 配置：
   - **Name**: `doc-qa-ratelimit`
   - **Region**: 选择最近的区域（如：ap-southeast-1）
   - **Type**: Regional
   - **TLS**: ✅ Enable
5. 点击 **"Create"**

### 步骤 2：获取 REST API 凭证

1. 在数据库详情页，切换到 **"REST API"** 标签
2. 复制以下信息：
   - **UPSTASH_REDIS_REST_URL**（例如：`https://xxxxx.upstash.io`）
   - **UPSTASH_REDIS_REST_TOKEN**（长字符串令牌）

### 步骤 3：配置本地环境

在项目根目录创建 `.env.local` 文件（如果不存在）：

```bash
# Upstash Redis for Rate Limiting (Story 4.1)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"
```

**替换**为你实际的凭证！

### 步骤 4：验证配置

#### 方法 A：使用验证脚本（推荐）

```bash
npm run verify:redis
```

**期望输出**：
```
✅ 配置验证通过！
```

**如果失败**，脚本会提示具体问题和解决方案。

#### 方法 B：手动验证

1. 启动应用：
   ```bash
   npm run dev
   ```

2. 检查控制台：
   - ✅ **成功**：无 Redis 错误或警告
   - ❌ **失败**：看到 "Upstash Redis requires a url and token"

### 步骤 5：功能测试

按照 [手动测试指南](../tests/manual/test-rate-limit-manual.md) 验证速率限制功能。

**快速测试**：
1. 登录应用
2. 连续上传 11 个文档
3. 第 11 次应该返回 **429 Too Many Requests**

---

## 生产环境配置

### Vercel 部署

1. 进入 Vercel 项目设置
2. **"Settings" → "Environment Variables"**
3. 添加变量：
   - `UPSTASH_REDIS_REST_URL` = `https://your-redis-url.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` = `your-redis-token-here`
   - Environments: ✅ Production, ✅ Preview
4. 重新部署

### 其他平台

- **Docker**: 在 `docker-compose.yml` 或环境变量中添加
- **AWS/Azure/GCP**: 在环境配置中添加
- **Kubernetes**: ConfigMap 或 Secret

---

## 配置验证清单

在标记 Story 4.1 为 Done 之前，确认：

- [ ] ✅ Upstash Redis 数据库已创建
- [ ] ✅ REST API 凭证已复制到 `.env.local`
- [ ] ✅ 运行 `npm run verify:redis` 成功
- [ ] ✅ 应用启动无 Redis 警告
- [ ] ✅ 连续上传测试，第 11 次返回 429
- [ ] ✅ 响应包含正确的错误消息和头部
- [ ] ✅ 日志记录超限事件
- [ ] ✅ （可选）生产环境变量已配置

---

## 故障排查

### 问题：验证脚本连接失败

**症状**：`npm run verify:redis` 报错 "连接失败"

**解决**：
1. 检查凭证是否正确（重新复制）
2. 确认数据库状态正常（Upstash Console）
3. 检查网络连接
4. 尝试使用更近的 Redis 区域

### 问题：速率限制不生效

**症状**：连续上传 11 次都成功

**诊断**：
1. 检查日志是否有 `rateLimitDegradation` 事件
2. 运行 `npm run verify:redis` 验证配置
3. 确认 Redis 数据库未被删除

### 问题：频繁降级警告

**症状**：日志中频繁出现 `alert: 'rateLimitDegradation'`

**原因**：
- Redis 凭证错误
- Redis 数据库区域太远（高延迟）
- 网络不稳定

**解决**：
- 验证凭证正确
- 考虑使用更近的区域
- 检查网络连接质量

---

## 相关文档

- **详细配置指南**：[docs/deployment/upstash-redis-setup.md](./deployment/upstash-redis-setup.md)
- **手动测试指南**：[tests/manual/test-rate-limit-manual.md](../tests/manual/test-rate-limit-manual.md)
- **Story 详情**：[docs/stories/4.1-upload-rate-limit.md](./stories/4.1-upload-rate-limit.md)
- **QA Gate**：[docs/qa/gates/4.1-upload-rate-limit.yml](./qa/gates/4.1-upload-rate-limit.yml)

---

## 成本估算

**Upstash Free Tier**：
- 10,000 命令/天
- 256 MB 存储
- 适合小型项目和开发

**估算**：每次上传检查 = 1 个 Redis 命令
- 100 用户 × 100 上传/天 = 10,000 命令/天 ✅ 免费层足够
- 超出后：$0.2/100K 命令

---

## 下一步

配置完成并验证通过后：

1. ✅ 完成功能测试
2. 📝 填写测试报告
3. 🎯 通知 QA 配置已完成
4. ✅ 更新 Story 状态为 **Done**

---

**配置帮助**：如有问题，参考 [Upstash 文档](https://docs.upstash.com/redis) 或联系团队。


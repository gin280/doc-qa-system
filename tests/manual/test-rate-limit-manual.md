# Story 4.1 - 手动测试指南

**目的**：验证上传速率限制功能正确配置和工作

**预计时间**：10-15分钟

---

## 前提条件

### 1. 配置 Upstash Redis 环境变量

**如果尚未配置，请先按照以下步骤操作：**

1. **创建 Upstash Redis 数据库**
   - 访问：https://console.upstash.com/
   - 注册/登录账号（免费层足够）
   - 点击 "Create Database"
   - 配置：
     - Name: `doc-qa-ratelimit`
     - Region: 选择最近的区域（例如：ap-southeast-1 新加坡）
     - Type: Regional
     - TLS: ✅ Enable
   - 点击 "Create"

2. **获取 REST API 凭证**
   - 在数据库详情页，切换到 **"REST API"** 标签
   - 复制：
     - `UPSTASH_REDIS_REST_URL`（例如：https://xxxxx.upstash.io）
     - `UPSTASH_REDIS_REST_TOKEN`（长字符串令牌）

3. **配置本地环境**
   - 在项目根目录创建 `.env.local` 文件（如果不存在）
   - 添加以下内容：
   ```bash
   # Upstash Redis for Rate Limiting (Story 4.1)
   UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"
   ```
   - 替换为你实际的凭证

**详细配置指南**：`docs/deployment/upstash-redis-setup.md`

---

## 测试步骤

### 测试 1: 启动验证

**目标**：确认应用启动正常，Redis 连接成功

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **检查控制台日志**
   - ✅ **期望**：无 Redis 错误或警告
   - ❌ **失败**：看到 "Upstash Redis requires a url and token" 或类似错误
     - 如果失败，检查 `.env.local` 配置

3. **访问应用**
   - 打开浏览器：http://localhost:3000
   - 登录测试账号

---

### 测试 2: 基本速率限制功能

**目标**：验证 10 次请求成功，第 11 次被限制

1. **准备测试文件**
   - 准备 11 个小文件（可以是同一个文件）
   - 建议：创建一个简单的 `test.txt` 文件

2. **连续上传 10 次**
   - 在文档上传页面，逐个选择并上传文件
   - 每次上传后，检查：
     - ✅ 上传成功提示
     - 🔍 打开浏览器开发者工具 → Network 标签
     - 查看上传请求的响应头：
       ```
       X-RateLimit-Limit: 10
       X-RateLimit-Remaining: 9, 8, 7, ... , 1, 0
       X-RateLimit-Reset: <timestamp>
       ```

3. **第 11 次上传**
   - 继续上传第 11 个文件
   - ✅ **期望**：
     - 上传失败
     - 错误提示：**"上传过于频繁，请稍后再试"**
     - HTTP 状态码：**429**
     - 响应头包含：
       ```
       Retry-After: <秒数>
       X-RateLimit-Limit: 10
       X-RateLimit-Remaining: 0
       X-RateLimit-Reset: <timestamp>
       ```
     - 响应体包含详细信息：
       ```json
       {
         "error": "上传过于频繁，请稍后再试",
         "details": {
           "limit": 10,
           "remaining": 0,
           "retryAfter": <秒数>,
           "resetAt": "<ISO 时间戳>"
         }
       }
       ```

---

### 测试 3: 时间重置验证

**目标**：验证 1 分钟后限制重置

1. **触发限制**
   - 完成测试 2，确保已触发限制

2. **等待重置**
   - 等待约 61 秒（根据 `Retry-After` 头提示的时间）
   - 或者查看 `resetAt` 时间戳，等待到该时间

3. **再次上传**
   - 上传一个新文件
   - ✅ **期望**：上传成功
   - 响应头 `X-RateLimit-Remaining` 应该重置为 `9`

---

### 测试 4: 多用户隔离

**目标**：验证不同用户有独立的限制

1. **用户 A 达到限制**
   - 使用当前账号上传 11 次，触发限制

2. **切换到用户 B**
   - 登出当前账号
   - 使用另一个测试账号登录

3. **用户 B 上传**
   - 上传一个文件
   - ✅ **期望**：上传成功
   - 用户 B 的限制独立，不受用户 A 影响

---

### 测试 5: 日志验证

**目标**：验证超限事件正确记录到日志

1. **触发限制**
   - 上传 11 次，触发第 11 次限制

2. **检查服务器日志**
   - 在运行 `npm run dev` 的终端查看日志
   - ✅ **期望**：看到类似以下的日志：
     ```
     WARN {
       event: 'rateLimitExceeded',
       userId: 'user_xxx',
       ip: '::1' 或 IP 地址,
       endpoint: '/api/documents/upload',
       timestamp: '2025-01-15T...',
       details: { limit: 10, remaining: 0, ... }
     }
     ```

---

### 测试 6: Redis 降级模式（可选）

**目标**：验证 Redis 不可用时系统仍然可用

⚠️ **警告**：此测试会临时破坏速率限制功能

1. **停止 Redis**
   - 在 Upstash Console 中临时暂停数据库
   - 或者在 `.env.local` 中临时注释掉 Redis 配置

2. **重启应用**
   ```bash
   # Ctrl+C 停止
   npm run dev
   ```

3. **尝试上传**
   - ✅ **期望**：
     - 上传仍然成功（降级模式）
     - 服务器日志包含降级警告：
       ```
       ERROR Rate limit check failed, degrading gracefully
       alert: 'rateLimitDegradation'
       ```

4. **恢复 Redis**
   - 恢复 `.env.local` 配置或重新启用数据库
   - 重启应用

---

## 测试报告模板

完成测试后，填写以下报告：

```markdown
# Story 4.1 手动测试报告

**测试日期**：{日期}
**测试人员**：{姓名}

## 环境信息
- Node 版本：{版本}
- Redis 配置：✅ 已配置 / ❌ 未配置
- Redis 区域：{区域}

## 测试结果

### 测试 1: 启动验证
- [ ] ✅ PASS / ❌ FAIL
- 备注：{如有问题描述}

### 测试 2: 基本速率限制
- [ ] ✅ PASS / ❌ FAIL
- 第 10 次上传：✅ 成功 / ❌ 失败
- 第 11 次上传：✅ 返回 429 / ❌ 未限制
- 错误消息：{消息内容}
- 备注：{如有问题描述}

### 测试 3: 时间重置
- [ ] ✅ PASS / ❌ FAIL
- 重置后上传：✅ 成功 / ❌ 失败
- 备注：{如有问题描述}

### 测试 4: 多用户隔离
- [ ] ✅ PASS / ❌ FAIL
- 备注：{如有问题描述}

### 测试 5: 日志验证
- [ ] ✅ PASS / ❌ FAIL
- 日志包含必要字段：✅ 是 / ❌ 否
- 备注：{如有问题描述}

### 测试 6: Redis 降级（可选）
- [ ] ✅ PASS / ❌ FAIL / ⏭️ SKIPPED
- 降级时仍可上传：✅ 是 / ❌ 否
- 降级日志正确：✅ 是 / ❌ 否
- 备注：{如有问题描述}

## 总体评估

- **所有测试通过**：✅ 是 / ❌ 否
- **可以部署**：✅ 是 / ❌ 否 / ⚠️ 有条件通过

## 问题和建议

{列出任何发现的问题或改进建议}

## 截图（可选）

- 429 响应截图
- 日志截图
```

---

## 常见问题

### Q1: 第 11 次上传没有返回 429

**可能原因**：
1. Redis 环境变量未配置 → 检查 `.env.local`
2. 应用未重启 → 修改环境变量后需重启
3. 使用了不同的用户账号 → 限制是按用户的
4. Redis 不可用 → 检查 Upstash Console 数据库状态

### Q2: 所有上传都失败

**可能原因**：
1. Redis 凭证错误 → 重新复制凭证
2. 网络问题 → 检查网络连接
3. Redis 数据库区域问题 → 尝试更近的区域

### Q3: 看不到 X-RateLimit-* 响应头

**解决**：
- 打开浏览器开发者工具
- 切换到 Network 标签
- 点击上传请求
- 查看 "Headers" → "Response Headers"

### Q4: 时间重置不生效

**可能原因**：
1. 未等待足够时间 → 至少等待 61 秒
2. 使用的不是滑动窗口算法 → 检查代码配置

---

## 下一步

测试通过后：
1. 填写测试报告
2. 将报告添加到 QA 文档
3. 通知 QA 完成验证
4. 更新 Story 状态为 **Done**

---

**相关文档**：
- 配置指南：`docs/deployment/upstash-redis-setup.md`
- Story 详情：`docs/stories/4.1-upload-rate-limit.md`
- QA Gate：`docs/qa/gates/4.1-upload-rate-limit.yml`


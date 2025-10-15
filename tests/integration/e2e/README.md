# E2E Integration Tests

## 📋 概述

端到端 (E2E) 集成测试验证完整的业务流程，从文档上传到问答生成。这些测试使用真实的系统组件：

- ✅ Supabase 数据库
- ✅ Supabase Storage  
- ✅ Redis 缓存
- ✅ LLM API (OpenAI/ZhipuAI)

## 🎯 测试覆盖

### 完整流程测试 (`complete-qa-flow.test.ts`)

验证核心业务流程：

1. **文档上传** → Supabase Storage
2. **文档解析** → 提取文本内容
3. **文档分块** → Chunking
4. **向量化** → Embedding generation
5. **存储** → 数据库 (chunks + vectors)
6. **查询** → 用户提问
7. **向量化查询** → 带缓存的 query embedding
8. **检索** → 相似度搜索
9. **生成** → LLM 流式回答
10. **保存** → 对话历史

### 边界情况测试 (`edge-cases.test.ts`)

测试各种边界情况和错误处理：

- ❌ 空文档上传
- 📦 超大文档处理 (10MB)
- 🚫 不支持的文件格式
- ❓ 无相关内容查询
- 🔀 并发查询处理
- 🔤 特殊字符处理
- 📏 超长查询处理

### 性能基准测试 (`performance.test.ts`)

验证系统性能指标：

| 操作 | 性能目标 | 验收标准 |
|-----|---------|---------|
| 文档上传 (1MB) | < 2秒 | 必须达成 |
| 文档处理完成 | < 30秒 | 必须达成 |
| 首次查询 (缓存未命中) | < 3秒 | 宽松限制 < 10秒 |
| 缓存命中查询 | < 1秒 | 宽松限制 < 10秒 |

**注意**: 实际性能会受 LLM API 延迟影响，使用宽松的时间限制。

## 🚀 运行测试

### 快速开始

```bash
# 运行所有 E2E 测试
npm run test:e2e

# Watch 模式 (开发时使用)
npm run test:e2e:watch

# 运行特定测试文件
npm run test:e2e -- complete-qa-flow.test.ts
```

### 环境要求

确保以下环境变量已配置：

```bash
# 数据库
DATABASE_URL=<postgres-connection-string>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_KEY=<service-key>

# LLM (至少配置一个)
OPENAI_API_KEY=<openai-key>
# 或
ZHIPUAI_API_KEY=<zhipuai-key>

# Redis (可选)
UPSTASH_REDIS_REST_URL=<redis-url>
UPSTASH_REDIS_REST_TOKEN=<redis-token>

# 应用 URL (测试时)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 前置条件

1. **启动开发服务器** (如果测试 API 路由):
   ```bash
   npm run dev
   ```

2. **数据库迁移已完成**:
   ```bash
   npm run db:migrate
   ```

3. **Supabase Storage bucket 已创建**:
   - Bucket 名称: `documents`
   - 权限: 服务密钥有完整访问权限

## 🧹 数据清理

### 自动清理

每个测试在 `afterAll` 中自动清理：

- 删除测试用户 (级联删除所有相关数据)
- 删除 Supabase Storage 文件
- 清理 Redis 缓存 (可选)

### 手动清理

如果测试中断或失败：

```bash
# 运行清理脚本
npm run test:cleanup:e2e
```

或手动清理：

```sql
-- 查找 E2E 测试数据
SELECT * FROM users WHERE email LIKE 'e2e-%@example.com';

-- 删除 (级联删除相关数据)
DELETE FROM users WHERE email LIKE 'e2e-%@example.com';
```

## 📁 目录结构

```
tests/integration/e2e/
├── complete-qa-flow.test.ts    # 完整流程测试
├── edge-cases.test.ts           # 边界情况测试
├── performance.test.ts          # 性能基准测试
├── helpers/
│   ├── e2e-setup.ts             # 测试环境初始化
│   ├── document-uploader.ts     # 文档上传辅助函数
│   └── query-executor.ts        # 查询执行辅助函数
└── README.md                    # 本文件
```

## 🔧 辅助函数

### E2E Setup (`helpers/e2e-setup.ts`)

```typescript
// 创建测试环境
const context = await setupE2ETest()

// 自动清理
await context.cleanup()
```

提供：
- 唯一的测试用户创建
- 自动数据清理
- 通用轮询函数

### Document Uploader (`helpers/document-uploader.ts`)

```typescript
// 上传并处理文档
const { documentId, filename } = await uploadAndProcessDocument(
  userId,
  'tests/fixtures/pdf/sample.pdf'
)

// 验证文档就绪
const { document, chunks } = await verifyDocumentReady(documentId)
```

提供：
- 完整的文档上传和处理流程
- 状态轮询和验证
- 错误处理

### Query Executor (`helpers/query-executor.ts`)

```typescript
// 执行查询
const result = await executeQuery(
  userId,
  documentId,
  '文档的主要内容是什么?'
)

// 验证对话历史
const { conversation, messages } = await verifyConversationHistory(
  conversationId
)

// 并发查询
const results = await executeConcurrentQueries(
  userId,
  documentId,
  ['问题1', '问题2', '问题3']
)
```

## ⚠️ 注意事项

### 1. API 配额消耗

E2E 测试会调用真实的 LLM API，会消耗配额：

- 每次查询消耗 tokens
- 建议使用测试专用的 API Key
- 可以设置请求限制

### 2. 测试时间

E2E 测试较慢：

- 单个测试: 1-3 分钟
- 完整套件: 5-15 分钟
- 设置合适的超时 (180秒)

### 3. 测试隔离

确保测试隔离：

- 使用基于时间戳的唯一 ID
- 不依赖测试执行顺序
- 每个测试独立运行

### 4. 失败调试

如果测试失败：

1. 查看详细日志输出
2. 检查环境变量配置
3. 验证服务可用性
4. 手动执行 API 调用测试
5. 检查数据库状态

### 5. CI/CD 集成

在 CI/CD 中运行 E2E 测试时：

- 使用测试环境的数据库
- 配置所有必需的环境变量
- 设置合适的超时
- 确保测试后清理数据

## 📊 性能监控

测试会输出性能指标：

```
✅ Document processed: 42 chunks created
💬 First query completed in 2847ms
💬 Second query completed in 1253ms
⚡ Cache effect: Faster
✅ Complete QA flow test passed!
   - Document processed: 42 chunks
   - First query: 2847ms
   - Second query: 1253ms
   - Total messages: 4
```

## 🐛 故障排除

### 测试超时

```
Error: Timeout - Async callback was not invoked within the 180000ms timeout
```

**解决方案**：
- 检查网络连接
- 验证 LLM API 可用性
- 增加超时时间
- 使用 Mock LLM (开发中)

### 数据库连接失败

```
Error: Connection refused
```

**解决方案**：
- 检查 `DATABASE_URL`
- 验证数据库迁移
- 确保数据库可访问

### Storage 上传失败

```
Error: Upload failed: 403
```

**解决方案**：
- 检查 `SUPABASE_SERVICE_KEY`
- 验证 Storage bucket 存在
- 确保权限配置正确

## 📚 相关文档

- [测试策略](../../../docs/testing/strategy.md)
- [集成测试说明](../README.md)
- [Story 4.10 文档](../../../docs/stories/4.10-e2e-integration-tests.md)

## 🎯 最佳实践

1. **测试前先清理**: `npm run test:cleanup:e2e`
2. **使用 Watch 模式开发**: `npm run test:e2e:watch`
3. **关注性能指标**: 监控测试输出的时间
4. **定期运行完整套件**: 确保没有回归
5. **记录失败原因**: 便于后续改进

## 📝 贡献指南

添加新的 E2E 测试时：

1. 使用现有的辅助函数
2. 遵循现有的命名约定
3. 添加清晰的测试描述
4. 确保测试隔离
5. 实现自动清理
6. 更新本 README

---

**最后更新**: 2025-01-15  
**维护者**: James (Dev Agent)


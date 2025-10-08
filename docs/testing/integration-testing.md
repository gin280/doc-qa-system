# 集成测试说明

## ⚠️ 重要提示

**集成测试会连接真实的 Supabase 数据库**，请谨慎运行！

## 测试策略

### 📁 目录结构

```
tests/
├── unit/           # 单元测试（Mock 数据库，快速）
│   ├── api/
│   ├── services/
│   └── lib/
└── integration/    # 集成测试（真实数据库，较慢）
    ├── api/        # API 端点集成测试
    ├── db/         # 数据库操作集成测试
    └── README.md   # 本文件
```

### 🎯 测试类型对比

| 类型 | 数据库 | 速度 | 用途 | 运行频率 |
|------|--------|------|------|---------|
| **单元测试** | Mock | ⚡ 快 | 测试业务逻辑 | 每次提交 |
| **集成测试** | Supabase | 🐌 慢 | 测试数据库交互 | 部署前 |

## 🚀 运行方式

### 运行所有单元测试（推荐日常开发）
```bash
npm test
# 或
npm run test:unit
```

### 运行所有集成测试（部署前）
```bash
npm run test:integration
```

### 运行特定集成测试
```bash
# 只测试数据库操作
npm run test:integration -- tests/integration/db

# 只测试用户 CRUD
npm run test:integration -- tests/integration/db/users.test.ts

# 只测试 API
npm run test:integration -- tests/integration/api
```

## 🧹 数据清理

### 自动清理
- 每个测试使用唯一的时间戳邮箱（`integration-test-{timestamp}@example.com`）
- 测试前后自动清理数据
- 即使测试失败，`afterAll` 也会清理

### 手动清理（如果测试中断）
```bash
# 清理所有测试数据
npm run test:cleanup
```

或手动在 Supabase SQL Editor 执行：
```sql
-- 查看所有测试用户
SELECT * FROM users 
WHERE email LIKE '%integration-test%' 
   OR email LIKE '%test@example.com';

-- 删除所有测试用户（级联删除相关数据）
DELETE FROM users 
WHERE email LIKE '%integration-test%' 
   OR email LIKE '%test@example.com';
```

## ⚙️ 环境配置

集成测试使用项目的 `DATABASE_URL` 环境变量：

```bash
# .env.local
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## 📋 最佳实践

### ✅ 推荐做法

1. **本地开发**：主要运行单元测试
   ```bash
   npm test
   ```

2. **提交前**：运行所有测试
   ```bash
   npm test && npm run test:integration
   ```

3. **CI/CD**：两者都运行
   ```yaml
   # .github/workflows/test.yml
   - run: npm test
   - run: npm run test:integration
   ```

### ❌ 避免

1. **不要在集成测试中使用固定邮箱**
   ```typescript
   // ❌ 错误
   const email = 'test@example.com'
   
   // ✅ 正确
   const email = `integration-test-${Date.now()}@example.com`
   ```

2. **不要跳过清理逻辑**
   ```typescript
   // ✅ 始终在 afterAll 中清理
   afterAll(async () => {
     await cleanup()
   })
   ```

3. **不要依赖测试执行顺序**
   - 每个测试应该独立
   - 使用 `beforeEach` 准备数据

## 🔍 故障排除

### 问题：测试失败留下脏数据

**解决：**
```bash
# 手动清理
npm run test:cleanup

# 或在 Supabase 执行 SQL
DELETE FROM users WHERE email LIKE '%test%';
```

### 问题：连接数据库超时

**解决：**
1. 检查 `DATABASE_URL` 是否正确
2. 确保 Supabase 项目未暂停
3. 检查网络连接

### 问题：测试太慢

**解决：**
```bash
# 只运行单元测试（快速）
npm test

# 或并行运行集成测试
npm run test:integration -- --maxWorkers=4
```

## 📊 覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看报告
open coverage/lcov-report/index.html
```

## 🔗 相关文档

- [测试指南](../../docs/TESTING_GUIDE.md)
- [数据库 Schema](../../drizzle/schema.ts)
- [Story 3.2 测试用例](../../docs/stories/3.2-TESTING-GUIDE.md)

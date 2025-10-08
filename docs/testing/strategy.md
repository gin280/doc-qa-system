# 测试策略文档

## 📋 概述

本项目采用**分层测试策略**，区分单元测试和集成测试：

- **单元测试**：Mock 所有外部依赖（数据库、API），快速验证业务逻辑
- **集成测试**：连接真实 Supabase 数据库，验证端到端功能

## 🎯 测试分类

### 单元测试 (80%)

**位置**：`tests/unit/`

**特点**：
- ⚡ 快速（毫秒级）
- 🔒 隔离（Mock 数据库）
- 🎯 聚焦业务逻辑

**运行**：
```bash
npm test
# 或
npm run test:unit
```

**示例**：
```typescript
// tests/unit/services/user/usageService.test.ts

// Mock 数据库
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockData])
      })
    })
  }
}))

describe('UsageService', () => {
  it('应该增加查询次数', async () => {
    await usageService.incrementQueryCount('user-1')
    expect(db.update).toHaveBeenCalled()
  })
})
```

---

### 集成测试 (20%)

**位置**：`tests/integration/`

**特点**：
- 🐌 较慢（秒级）
- 🌐 真实数据库（Supabase）
- 🔗 端到端验证

**运行**：
```bash
# 所有集成测试
npm run test:integration

# 只测数据库
npm run test:integration:db

# 只测 API
npm run test:integration:api
```

**示例**：
```typescript
// tests/integration/db/users.test.ts

// ⚠️ 直接连接真实数据库
import { db } from '../../../src/lib/db'

describe('User CRUD (Integration)', () => {
  const TEST_EMAIL = `integration-test-${Date.now()}@example.com`

  afterAll(async () => {
    // 自动清理
    await db.delete(users).where(eq(users.email, TEST_EMAIL))
  })

  it('应该创建用户', async () => {
    const [user] = await db.insert(users).values({
      email: TEST_EMAIL,
      name: 'Test User',
    }).returning()
    
    expect(user.email).toBe(TEST_EMAIL)
  })
})
```

---

## 📊 测试金字塔

```
        /\
       /  \     E2E (5%)
      /____\    - Playwright/Cypress
     /      \   
    / 集成测试 \  (15%)
   /___________\ - 真实数据库
  /             \
 /   单元测试     \ (80%)
/__________________\ - Mock 所有依赖
```

---

## 🔧 日常开发流程

### 开发新功能

```bash
# 1. 编写代码
vim src/services/newService.ts

# 2. 编写单元测试（Mock 数据库）
vim tests/unit/services/newService.test.ts

# 3. 运行单元测试
npm test

# 4. 如果涉及数据库操作，编写集成测试
vim tests/integration/api/new-feature.test.ts

# 5. 提交前运行所有测试
npm run test:all
```

---

## 🧹 测试数据清理

### 自动清理

每个集成测试都会在 `afterAll` 中自动清理数据：

```typescript
afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL))
})
```

### 手动清理

如果测试中断或失败，运行清理脚本：

```bash
npm run test:cleanup
```

或手动在 Supabase SQL Editor 执行：

```sql
-- 查看测试数据
SELECT * FROM users 
WHERE email LIKE '%integration-test%' 
   OR email LIKE '%test@example.com';

-- 删除测试数据
DELETE FROM users 
WHERE email LIKE '%integration-test%' 
   OR email LIKE '%test@example.com';
```

---

## 📝 编写测试最佳实践

### ✅ 单元测试

**1. Mock 所有外部依赖**

```typescript
// ✅ 正确
jest.mock('@/lib/db')
jest.mock('@/lib/auth')
jest.mock('@supabase/supabase-js')

// ❌ 错误：直接导入真实数据库
import { db } from '@/lib/db' // 这会连接真实数据库
```

**2. 测试业务逻辑，不测试框架**

```typescript
// ✅ 正确：测试业务逻辑
it('应该在用户不存在时创建新记录', async () => {
  mockDb.select.mockResolvedValue([])
  await usageService.getUserUsage('user-1')
  expect(mockDb.insert).toHaveBeenCalled()
})

// ❌ 错误：测试 Drizzle ORM
it('should call db.insert', async () => {
  await db.insert(users).values({...})
  expect(db.insert).toHaveBeenCalled() // 这只是测试框架
})
```

**3. 使用描述性测试名称**

```typescript
// ✅ 正确
it('应该在密码错误时返回401错误', async () => {})

// ❌ 错误
it('test login', async () => {})
```

---

### ✅ 集成测试

**1. 使用唯一标识符**

```typescript
// ✅ 正确：时间戳保证唯一
const TEST_EMAIL = `integration-test-${Date.now()}@example.com`

// ❌ 错误：固定值可能冲突
const TEST_EMAIL = 'test@example.com'
```

**2. 始终清理数据**

```typescript
// ✅ 正确
afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_EMAIL))
})

// ❌ 错误：不清理
// （测试后留下脏数据）
```

**3. 添加警告注释**

```typescript
/**
 * ⚠️ 警告：此测试会连接真实数据库（Supabase）
 */
```

---

## 🚀 CI/CD 集成

### GitHub Actions 配置示例

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📈 覆盖率目标

| 类型 | 目标覆盖率 | 当前 |
|------|-----------|------|
| 单元测试 | 80%+ | - |
| 集成测试 | 关键路径 100% | - |
| 总体 | 75%+ | - |

**查看覆盖率**：
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## 🔍 常见问题

### Q: 什么时候写单元测试？

**A:** 任何包含业务逻辑的代码都应该有单元测试：
- Service 层（核心业务逻辑）
- Util 函数（工具函数）
- Hook（React 逻辑）

### Q: 什么时候写集成测试？

**A:** 需要验证端到端流程时：
- 数据库操作（CRUD、级联删除）
- API 端点（完整请求-响应周期）
- 关键业务流程（注册、登录、文档上传）

### Q: 单元测试很慢怎么办？

**A:** 
1. 确保所有外部依赖都 Mock 了
2. 避免异步等待（使用 `mockResolvedValue`）
3. 并行运行：`npm test -- --maxWorkers=4`

### Q: 集成测试留下脏数据怎么办？

**A:**
```bash
npm run test:cleanup
```

---

## 📚 相关文档

- [集成测试说明](../tests/integration/README.md)
- [Story 3.2 测试指南](./stories/3.2-TESTING-GUIDE.md)
- [数据库 Schema](../drizzle/schema.ts)

---

## 🎯 总结

**日常开发**：
```bash
npm test  # 只运行单元测试（快速）
```

**提交前**：
```bash
npm run test:all  # 运行所有测试
```

**部署前**：
```bash
npm run predeploy  # 验证 + 构建 + 测试
```

**清理测试数据**：
```bash
npm run test:cleanup
```

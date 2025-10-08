# 测试文档中心

欢迎来到 DocQA System 测试文档中心！

## 🎯 快速导航

### 我应该看哪个文档？

| 你的角色/目标 | 推荐文档 |
|-------------|---------|
| **刚加入项目** | 👉 [测试策略概览](strategy.md) |
| **写单元测试** | 👉 [单元测试指南](unit-testing.md) |
| **写集成测试** | 👉 [集成测试指南](integration-testing.md) |
| **测试特定 Story** | 👉 [Story 专用测试](#story-专用测试) |
| **运行测试** | 👉 [快速开始](#快速开始) |
| **清理测试数据** | 👉 [数据清理](#数据清理) |

---

## 📚 核心文档

### 1. [测试策略概览](strategy.md) ⭐ 必读

**内容**：
- 单元测试 vs 集成测试对比
- 测试金字塔原则
- 日常开发流程
- 最佳实践和常见问题

**适用**：所有开发者

---

### 2. [单元测试指南](unit-testing.md)

**内容**：
- 如何编写单元测试
- Mock 数据库和外部依赖
- 测试业务逻辑的最佳实践
- 常见错误和解决方案

**适用**：编写 Service、Hook、Util 测试

---

### 3. [集成测试指南](integration-testing.md)

**内容**：
- 如何编写集成测试
- 连接真实 Supabase 数据库
- 自动清理测试数据
- 运行方式和注意事项

**适用**：编写 API、数据库操作测试

---

## 🚀 快速开始

### 日常开发（推荐）

```bash
# 只运行单元测试（快速，不连接数据库）
npm test
```

### 提交前

```bash
# 运行所有测试
npm run test:all
```

### 只运行特定类型

```bash
# 只运行单元测试
npm run test:unit

# 只运行集成测试
npm run test:integration

# 只运行数据库集成测试
npm run test:integration:db

# 只运行 API 集成测试
npm run test:integration:api
```

---

## 🧹 数据清理

如果集成测试失败或中断，可能在 Supabase 留下测试数据：

```bash
# 自动清理所有测试数据
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

## 📊 Story 专用测试

部分 Story 有专门的测试指南：

| Story | 测试文档 | 内容 |
|-------|---------|------|
| Story 2.4 | [文档向量化测试](story-specific/2.4-vectorization-testing.md) | 手动测试文档分块和向量化流程 |
| Story 3.2 | [RAG 向量检索测试](story-specific/3.2-rag-testing.md) | RAG 检索功能的完整测试方案 |

---

## 📈 覆盖率

查看测试覆盖率：

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

**目标**：
- 单元测试覆盖率：≥ 80%
- 关键路径集成测试：100%
- 总体覆盖率：≥ 75%

---

## 🎯 测试金字塔

```
        /\
       /  \     E2E (5%)
      /____\    - Playwright/Cypress
     /      \   
    / 集成测试 \  (15%)
   /___________\ - 真实数据库、API
  /             \
 /   单元测试     \ (80%)
/__________________\ - Mock 所有依赖
```

**原则**：
- 80% 单元测试（快速验证业务逻辑）
- 15% 集成测试（验证系统集成）
- 5% E2E 测试（验证用户流程）

---

## ❓ 常见问题

### Q: 我的单元测试很慢，怎么办？

**A:** 检查是否有测试文件直接导入了 `@/lib/db`，应该 Mock 它：

```typescript
// ❌ 错误：会连接真实数据库
import { db } from '@/lib/db'

// ✅ 正确：Mock 数据库
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn()
  }
}))
```

---

### Q: 集成测试留下脏数据怎么办？

**A:** 运行清理脚本：

```bash
npm run test:cleanup
```

---

### Q: 什么时候写单元测试，什么时候写集成测试？

**A:**

**单元测试**（业务逻辑）：
- Service 层函数
- Util 工具函数
- React Hooks
- 数据转换逻辑

**集成测试**（端到端）：
- API 端点
- 数据库操作
- 第三方服务集成

---

### Q: 如何调试失败的测试？

**A:**

```bash
# 单个测试文件
npm test -- path/to/test.test.ts

# 监听模式（自动重跑）
npm run test:watch

# 调试模式
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## 🔗 相关资源

### 项目文档
- [项目架构](../architecture.md)
- [Story 列表](../prd/epic-story-index.md)
- [Story 1.9: 测试基础设施](../stories/1.9-testing-infrastructure.md)

### 外部资源
- [Jest 文档](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Drizzle ORM 测试](https://orm.drizzle.team/docs/guides/testing)

---

## 🎓 学习路径

### 新手（0-1周）
1. 阅读 [测试策略](strategy.md)
2. 跟着 [单元测试指南](unit-testing.md) 写第一个测试
3. 运行 `npm test` 查看效果

### 进阶（1-2周）
1. 学习 Mock 技巧
2. 阅读 [集成测试指南](integration-testing.md)
3. 编写端到端 API 测试

### 高级（2周+）
1. 优化测试性能
2. 提高覆盖率
3. 贡献测试最佳实践

---

## 📞 需要帮助？

- 💬 **Slack**: #testing 频道
- 📝 **文档问题**: 提 Issue 或 PR
- 👤 **联系人**: Full Stack Developer (James)

---

**文档版本**: 1.0  
**创建日期**: 2025-01-15  
**最后更新**: 2025-01-15  
**维护人**: Product Owner (Sarah)

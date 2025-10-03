# 💾 数据库设置指南

## 📋 概述

本项目使用 **Supabase** 作为 PostgreSQL 数据库提供商，使用 **Drizzle ORM** 进行数据库操作。

**预计时间**: 15 分钟

---

## 🚀 快速开始（5分钟版）

### 1. 创建 Supabase 项目

1. 访问 [https://supabase.com/](https://supabase.com/)
2. 注册/登录账号
3. 点击 **"New Project"**
4. 填写项目信息:
   - **Project Name**: `doc-qa-system-dev`
   - **Database Password**: 设置强密码（**请记住！**）
   - **Region**: 选择离你最近的区域
5. 等待项目创建完成（约2分钟）

### 2. 获取连接信息

在 Supabase 控制台中：

**获取 DATABASE_URL**:
1. 左侧菜单 → **Settings** ⚙️ → **Database**
2. 找到 **Connection string** 部分
3. 选择 **URI** 标签
4. 复制连接字符串，格式类似：
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. 将 `[YOUR-PASSWORD]` 替换为你设置的密码

**获取 Supabase 公共配置**:
1. 左侧菜单 → **Settings** → **API**
2. 复制 **Project URL**
3. 复制 **Project API keys** 中的 `anon` `public` key

### 3. 配置环境变量

在项目根目录执行：

```bash
# 1. 复制环境变量模板
cp .env.local.example .env.local

# 2. 编辑 .env.local 文件
# 使用你喜欢的编辑器打开
```

填入以下内容：

```env
# Database - 从步骤2获取
DATABASE_URL="postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase 公共配置 - 从步骤2获取
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# NextAuth 配置（暂时保持这些值）
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# OAuth 配置（暂时保持空，后续步骤配置）
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

### 4. 执行数据库迁移

```bash
# 推送 Schema 到数据库
npm run db:push
```

**预期输出**：
```
✔ Pushing schema changes to database...
✔ Done!
```

### 5. 验证数据库

**方式 1: 使用 Drizzle Studio**（推荐）
```bash
npm run db:studio
```
浏览器会打开可视化界面，你可以看到所有表。

**方式 2: 在 Supabase 控制台**
1. 进入 **Database** → **Tables**
2. 应该看到 **7 个表**：
   - `users`
   - `documents`
   - `document_chunks`
   - `conversations`
   - `messages`
   - `citations`
   - `user_usage`

### 6. 运行测试（可选）

```bash
# 运行数据库测试
npm test tests/unit/db

# 查看测试覆盖率
npm run test:coverage
```

---

## ✅ 完成！

数据库配置完成，可以继续 [OAuth 配置](./2-oauth-setup.md)。

---

## 📚 详细说明

### 数据库 Schema 概览

项目使用 **7 个表** 存储数据，完整定义在 `drizzle/schema.ts`：

#### 核心表

1. **users** - 用户账户
   - 字段: id, email, passwordHash, name, avatarUrl, authProvider, createdAt, updatedAt
   - 索引: email (唯一)
   - 认证方式: EMAIL, GOOGLE, GITHUB

2. **documents** - 文档管理
   - 字段: id, userId, title, status, metadata, uploadedAt, processedAt
   - 索引: userId, status
   - 状态: PENDING, PROCESSING, COMPLETED, FAILED

3. **document_chunks** - 文档分块（向量搜索）
   - 字段: id, documentId, content, embedding, metadata, chunkIndex
   - 索引: documentId, chunkIndex
   - 唯一约束: (documentId, chunkIndex)

4. **conversations** - 对话会话
   - 字段: id, userId, title, createdAt, updatedAt
   - 索引: userId

5. **messages** - 对话消息
   - 字段: id, conversationId, role, content, createdAt
   - 索引: conversationId
   - 角色: USER, ASSISTANT, SYSTEM

6. **citations** - 引用来源
   - 字段: id, messageId, documentChunkId, relevanceScore
   - 索引: messageId, documentChunkId

7. **user_usage** - 用户使用统计
   - 字段: id, userId, date, questionsAsked, documentsUploaded
   - 索引: userId, date
   - 唯一约束: (userId, date)

#### 关系设计

- **级联删除**: 删除用户会自动删除其所有关联数据
- **外键约束**: 所有关系都有外键约束保证数据完整性
- **索引优化**: 在所有外键和常用查询字段上创建了索引

---

## 🛠️ 数据库操作命令

### 迁移管理

```bash
# 方式 1: 直接推送 Schema（开发推荐）
npm run db:push

# 方式 2: 使用迁移文件（生产推荐）
npm run db:migrate
```

**区别**：
- `db:push`: 直接同步 Schema，快速开发
- `db:migrate`: 执行版本化迁移文件，可追溯历史

### 数据库工具

```bash
# 打开 Drizzle Studio（可视化管理）
npm run db:studio

# 生成新的迁移文件
npm run db:generate
```

### 开发测试

```bash
# 运行所有数据库测试
npm test tests/unit/db

# 运行特定测试文件
npm test tests/unit/db/users.test.ts

# 查看测试覆盖率
npm run test:coverage
```

---

## 🚨 故障排查

### 错误: "DATABASE_URL is not set"

**原因**: 环境变量未配置或未加载

**解决方法**:
1. 确认 `.env.local` 文件存在于项目根目录
2. 确认文件中有 `DATABASE_URL=...` 配置
3. 重启开发服务器 (`npm run dev`)
4. 检查是否有 `.env.local` 在 `.gitignore` 中（应该有）

### 错误: "Could not connect to database"

**原因**: 数据库连接信息错误

**解决方法**:
1. **检查 DATABASE_URL 格式**:
   ```
   postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]
   ```
2. **检查密码编码**: 如果密码包含特殊字符，可能需要 URL 编码
   - 示例: `p@ss` → `p%40ss`
3. **验证 Supabase 项目状态**: 确认项目正在运行（绿色状态）
4. **检查网络连接**: 尝试 ping Supabase 主机

### 错误: "relation already exists"

**原因**: 数据库中已有同名表

**解决方法**:

**方式 1: 删除现有表（开发环境）**
1. 在 Supabase 控制台 → **Database** → **Tables**
2. 手动删除所有表
3. 重新运行 `npm run db:push`

**方式 2: 创建新项目（最简单）**
1. 在 Supabase 创建新项目
2. 更新 `.env.local` 中的连接信息
3. 运行 `npm run db:push`

**方式 3: 使用迁移重置（生产不推荐）**
```bash
# 警告：这会删除所有数据！
# 仅在开发环境使用
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
npm run db:push
```

### 测试失败

**原因**: 数据库未配置或连接失败

**解决方法**:
1. 确认 `.env.local` 配置正确
2. 确认已执行 `npm run db:push`
3. 确认数据库连接正常（运行 `npm run db:studio`）
4. 检查测试环境变量是否加载（`jest.setup.js`）

### 密码包含特殊字符

**问题**: 连接字符串中特殊字符未编码

**解决方法**: 使用 URL 编码

常见字符编码：
```
@ → %40
# → %23
$ → %24
% → %25
& → %26
+ → %2B
```

**示例**:
```env
# 原始密码: MyP@ss#123
DATABASE_URL="postgresql://postgres:MyP%40ss%23123@host:5432/postgres"
```

---

## 🔒 生产环境最佳实践

### 数据库安全

1. **使用强密码**
   - 至少 16 字符
   - 包含大小写字母、数字、特殊字符
   - 不使用常见单词

2. **限制访问**
   - 仅允许必要的 IP 地址访问
   - 使用 Supabase 的连接池

3. **定期备份**
   - Supabase 自动备份（每天）
   - 重要数据手动导出

4. **监控连接**
   - 监控数据库连接数
   - 设置连接池大小限制

### 迁移策略

**开发环境**:
```bash
npm run db:push  # 快速迭代
```

**生产环境**:
```bash
npm run db:generate  # 生成迁移文件
# 审查生成的 SQL
npm run db:migrate   # 执行迁移
```

### 性能优化

1. **索引优化**: 已在常用查询字段上创建索引
2. **连接池**: 使用 Supabase Pooler（端口 6543）
3. **查询优化**: 使用 Drizzle 的类型安全查询

---

## 📊 数据库监控

### Supabase Dashboard

访问 Supabase 项目的 Dashboard 可以看到：

1. **Database**
   - 表结构和数据
   - SQL 编辑器
   - 备份管理

2. **API Logs**
   - 实时请求日志
   - 错误追踪

3. **Database Health**
   - CPU 使用率
   - 内存使用
   - 连接数

### 推荐监控指标

- 数据库连接数（目标: < 80%）
- 查询响应时间（目标: P95 < 100ms）
- 错误率（目标: < 0.1%）
- 存储使用量

---

## 📚 相关文档

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Supabase 文档](https://supabase.com/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [下一步: OAuth 配置](./2-oauth-setup.md)

---

## 🔄 数据库版本历史

| 迁移版本 | 日期 | 描述 |
|---------|------|------|
| 0001 | 2025-01-03 | 初始 Schema - 7个表 |

---

**最后更新**: 2025-01-03  
**维护者**: Dev Team


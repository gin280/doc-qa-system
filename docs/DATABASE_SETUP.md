# 数据库设置指南

## 前提条件

本项目使用Supabase作为PostgreSQL数据库提供商。请先完成以下步骤：

### 1. 创建Supabase项目

1. 访问 [Supabase官网](https://supabase.com/)
2. 注册/登录账号
3. 创建新项目
4. 记录数据库连接信息

### 2. 配置环境变量

1. 复制环境变量模板：
```bash
cp .env.local.example .env.local
```

2. 编辑 `.env.local` 文件，填入Supabase数据库URL：

```env
# Database - 从Supabase项目设置中获取
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# NextAuth (暂时可以留空，后续Story会用到)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# Supabase公共配置 - 从Supabase项目设置中获取
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
```

### 3. 获取DATABASE_URL

在Supabase控制台中:
1. 进入项目设置 (Settings)
2. 选择 Database
3. 找到 "Connection String" → "URI"
4. 复制完整的连接字符串
5. 将 `[YOUR-PASSWORD]` 替换为你的数据库密码

示例:
```
postgresql://postgres:your_password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

## 执行数据库迁移

配置好环境变量后，执行以下命令：

### 方式1: 使用 db:push (推荐用于开发)

```bash
npm run db:push
```

这个命令会直接将Schema同步到数据库，适合快速开发。

### 方式2: 使用迁移文件 (生产环境推荐)

```bash
# 迁移文件已生成在 drizzle/migrations/
# 执行迁移
npm run db:migrate
```

## 验证数据库

### 使用Drizzle Studio查看数据库

```bash
npm run db:studio
```

浏览器会打开 Drizzle Studio 界面，可以：
- 查看所有表结构
- 浏览数据
- 执行CRUD操作

### 手动验证表创建

在Supabase控制台中：
1. 进入 Database → Tables
2. 应该看到以下表：
   - users
   - documents
   - document_chunks
   - conversations
   - messages
   - citations
   - user_usage

## 运行测试

**重要**: 测试会对数据库进行实际操作，建议使用开发数据库。

```bash
# 运行所有数据库测试
npm test tests/unit/db

# 运行特定测试
npm test tests/unit/db/users.test.ts

# 查看测试覆盖率
npm run test:coverage
```

## 数据库Schema

完整的Schema定义在 `drizzle/schema.ts`，包括：

- **7个表**: users, documents, document_chunks, conversations, messages, citations, user_usage
- **3个枚举**: auth_provider, document_status, message_role  
- **级联删除**: 删除用户会自动删除其所有关联数据
- **索引优化**: 在所有外键和常用查询字段上创建了索引
- **唯一约束**: email字段唯一，document_chunks有复合唯一约束

## 故障排查

### 错误: "DATABASE_URL is not set"

- 确认 `.env.local` 文件存在
- 确认文件中有 `DATABASE_URL=...` 配置
- 重启开发服务器

### 错误: "Could not connect to database"

- 检查DATABASE_URL格式是否正确
- 检查Supabase项目是否在运行
- 检查网络连接
- 验证数据库密码是否正确

### 错误: "relation already exists"

- 数据库中已有同名表
- 解决方案1: 在Supabase控制台手动删除表
- 解决方案2: 创建新的Supabase项目

## 下一步

数据库设置完成后，可以继续：
- Story 1.3: 用户注册功能实现
- Story 1.4: 用户登录与Session管理

## 相关文档

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Supabase 文档](https://supabase.com/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)


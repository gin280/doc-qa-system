# Supabase AI Rules for Cursor

这个文件夹包含了所有 Supabase 相关的 AI 编程规则，来自 [Supabase 官方 AI Prompts 文档](https://supabase.com/docs/guides/getting-started/ai-prompts)。

## 📁 规则文件列表

### 核心规则（始终生效 ⭐）

| 文件 | 用途 | 状态 |
|------|------|------|
| **../supabase-guide.md** | 智能规则路由 - 自动检测并加载对应规则 | `alwaysApply: true` ⭐ |
| **sql-style-guide.md** | PostgreSQL 代码风格指南 | `alwaysApply: true` ⭐ |
| **rls-policies.md** | 行级安全策略（RLS）编写指南 | `alwaysApply: true` ⭐ |

### 详细规则（按需自动加载）

| 文件 | 用途 | 触发关键词 |
|------|------|-----------|
| **realtime.md** | Supabase Realtime 实时功能开发指导 | `realtime`, `broadcast`, `presence`, `channel` |
| **nextjs-auth.md** | Next.js + Supabase Auth 集成规范 | `auth`, `signIn`, `session`, `middleware` |
| **edge-functions.md** | Edge Functions 编写规范 | `edge function`, `deno`, `supabase/functions/` |
| **declarative-schema.md** | 声明式数据库架构管理 | `supabase/schemas/`, `db diff` |
| **database-functions.md** | 数据库函数编写指南 | `create function`, `trigger`, `plpgsql` |
| **database-migrations.md** | 数据库迁移文件创建规范 | `migration`, `supabase/migrations/` |

## 🚀 如何使用

### ⭐ 智能自动路由（推荐）

项目已配置 **智能规则路由** (`.cursor/rules/supabase-guide.md`)，当你的代码涉及 Supabase 时，AI 会自动：

1. **检测场景**：识别你在做什么（认证、RLS、实时功能等）
2. **加载规则**：自动引用对应的详细规则文件
3. **生成代码**：按照最佳实践生成符合规范的代码

**你只需要正常提问：**
```
帮我创建一个实时聊天功能
→ AI 自动加载 realtime.md 规则

为 posts 表创建 RLS 策略
→ AI 自动加载 rls-policies.md 规则

实现用户登录功能
→ AI 自动加载 nextjs-auth.md 规则
```

### 手动引用（可选）

如果需要明确指定规则：

1. **通过 @ 符号引用**：
   ```
   @.cursor/rules/supabase/realtime.md 帮我实现实时聊天功能
   ```

2. **在对话中引用**：
   ```
   根据 Supabase Realtime 规则，实现房间消息广播
   ```

### 在其他 AI 工具中使用

- **GitHub Copilot**: 使用 `#<文件名>` 引用
- **Zed**: 使用 `/file` 命令引用
- **其他**: 复制规则内容到对话中

## 📚 规则详解

### 1. Realtime 实时功能
- 优先使用 `broadcast` 而非 `postgres_changes`
- 使用专用 topic 提高性能
- 始终使用 `private: true` 增强安全性
- 实现适当的错误处理和重连逻辑

### 2. Next.js 认证
- 必须使用 `@supabase/ssr` 包
- 仅使用 `getAll` 和 `setAll` cookie 方法
- 禁止使用已弃用的 `auth-helpers-nextjs`
- 正确配置中间件刷新令牌

### 3. Edge Functions
- 优先使用 Web APIs 和 Deno 核心 API
- 使用 `npm:` 或 `jsr:` 前缀导入依赖
- 始终指定版本号
- 使用内置的 `Deno.serve`

### 4. 声明式 Schema
- 所有 schema 修改在 `supabase/schemas/` 目录
- 使用 `supabase db diff` 生成迁移
- 禁止手动修改 `supabase/migrations/`
- 注意已知限制（DML、视图所有权、RLS 等）

### 5. RLS 策略
- 为每个操作创建独立策略
- 使用 `auth.uid()` 而非 `current_user`
- 为策略添加索引以提高性能
- 始终指定角色（`to authenticated` / `to anon`）

### 6. 数据库函数
- 默认使用 `SECURITY INVOKER`
- 始终设置 `search_path = ''`
- 使用完全限定名（schema.table）
- 选择适当的函数稳定性（IMMUTABLE/STABLE/VOLATILE）

### 7. 数据库迁移
- 文件名格式：`YYYYMMDDHHmmss_description.sql`
- 所有 SQL 关键字小写
- 新表必须启用 RLS
- 为破坏性操作添加详细注释

### 8. SQL 风格指南
- 使用 snake_case 命名
- 表名复数，列名单数
- 使用 `as` 关键字定义别名
- 复杂查询使用 CTE
- 为所有表添加注释

## 🎯 项目特定配置

根据你的 `doc-qa-system` 项目需求，以下规则特别重要：

1. **认证系统** → `nextjs-auth.md`
2. **文档权限** → `rls-policies.md`
3. **数据库设计** → `database-migrations.md` + `sql-style-guide.md`
4. **实时问答** → `realtime.md`（如果需要实时更新）

## 📖 参考链接

- [Supabase AI Prompts 官方文档](https://supabase.com/docs/guides/getting-started/ai-prompts)
- [Supabase 文档](https://supabase.com/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

## 💡 最佳实践

1. **优先级排序**：先阅读 `sql-style-guide.md` 和 `rls-policies.md`
2. **安全第一**：所有表必须启用 RLS
3. **性能优化**：为常用查询列添加索引
4. **代码质量**：遵循命名约定和格式规范
5. **版本控制**：通过迁移管理所有数据库变更

## 🔧 维护说明

这些规则文件基于 Supabase 官方文档（2025年1月版本）。如需更新：

1. 访问 [Supabase AI Prompts](https://supabase.com/docs/guides/getting-started/ai-prompts)
2. 检查是否有规则更新
3. 更新对应的规则文件
4. 更新此 README 的最后更新日期

**最后更新**: 2025-01-11


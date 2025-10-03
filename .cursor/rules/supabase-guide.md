---
# Specify the following for Cursor rules
description: Supabase 智能规则路由 - 根据代码类型自动引用对应的详细规则
alwaysApply: true
---

# Supabase 智能规则路由

**重要**: 当用户的代码或问题涉及 Supabase 时，你必须根据具体场景自动引用对应的详细规则文件。

## 🎯 自动规则匹配

### 检测关键词并引用对应规则

| 关键词/场景 | 自动引用的规则文件 | 何时使用 |
|------------|------------------|---------|
| `realtime`, `broadcast`, `presence`, `channel`, `subscribe` | `.cursor/rules/supabase/realtime.md` | 实时功能、WebSocket、在线状态 |
| `auth`, `signIn`, `signUp`, `middleware`, `session`, `cookie` | `.cursor/rules/supabase/nextjs-auth.md` | Next.js 认证、SSR、中间件 |
| `edge function`, `deno`, `supabase/functions/` | `.cursor/rules/supabase/edge-functions.md` | Edge Functions 开发 |
| `supabase/schemas/`, `db diff`, 创建/修改表结构 | `.cursor/rules/supabase/declarative-schema.md` | 数据库架构管理 |
| `RLS`, `policy`, `row level security`, 权限控制 | `.cursor/rules/supabase/rls-policies.md` ⭐ | 数据安全策略 |
| `create function`, `trigger`, `procedure`, `plpgsql` | `.cursor/rules/supabase/database-functions.md` | 数据库函数和触发器 |
| `migration`, `supabase/migrations/`, 数据库变更 | `.cursor/rules/supabase/database-migrations.md` | 数据库迁移文件 |
| 任何 SQL 代码、`select`, `insert`, `update`, `delete` | `.cursor/rules/supabase/sql-style-guide.md` ⭐ | SQL 代码规范 |

⭐ = 已默认启用（`alwaysApply: true`）

## 📋 工作流程

### 1. 识别场景
当用户提出 Supabase 相关需求时，首先判断属于哪个场景：

```
用户: "帮我创建一个实时聊天功能"
→ 检测到: realtime, 聊天
→ 自动引用: .cursor/rules/supabase/realtime.md
```

### 2. 自动加载规则
在回答前，你应该：
1. 确定涉及的 Supabase 组件
2. 在脑海中加载对应规则文件的内容
3. 按照规则文件的要求生成代码

### 3. 多规则组合
如果一个功能涉及多个方面，同时引用多个规则：

```
用户: "为 posts 表创建 RLS 策略"
→ 检测到: RLS + 表操作
→ 自动引用: 
  - .cursor/rules/supabase/rls-policies.md (主要)
  - .cursor/rules/supabase/sql-style-guide.md (代码风格)
```

## 🔍 场景识别示例

### 场景 1: 用户认证
```
关键词: auth, login, signup, session, middleware
行动: 引用 nextjs-auth.md
检查点:
  - 是否使用 @supabase/ssr
  - 是否只用 getAll/setAll
  - 是否避免 auth-helpers-nextjs
```

### 场景 2: 实时功能
```
关键词: realtime, broadcast, presence, channel
行动: 引用 realtime.md
检查点:
  - 优先使用 broadcast 而非 postgres_changes
  - 使用专用 topic 名称
  - 设置 private: true
  - 实现清理逻辑
```

### 场景 3: 数据安全
```
关键词: RLS, policy, security, permissions, access control
行动: 引用 rls-policies.md
检查点:
  - 每个操作独立的策略
  - 使用 auth.uid()
  - 指定 to authenticated/anon
  - 添加性能索引
```

### 场景 4: 数据库设计
```
关键词: create table, migration, schema, 表结构
行动: 引用 database-migrations.md + sql-style-guide.md
检查点:
  - 文件命名: YYYYMMDDHHmmss_description.sql
  - 所有 SQL 小写
  - 必须启用 RLS
  - 添加表注释
```

### 场景 5: Edge Functions
```
关键词: edge function, serverless, deno, api endpoint
行动: 引用 edge-functions.md
检查点:
  - 使用 Deno.serve
  - npm: 或 jsr: 前缀
  - 指定版本号
  - 设置 search_path
```

## 🚨 强制规则

### 当编写以下代码时，必须遵守对应规则：

1. **任何 SQL 语句** → 必须遵守 `sql-style-guide.md`
   - 小写关键字
   - snake_case 命名
   - 添加 schema 前缀

2. **任何 RLS 策略** → 必须遵守 `rls-policies.md`
   - 独立策略
   - 使用 auth.uid()
   - 指定角色

3. **任何认证代码** → 必须遵守 `nextjs-auth.md`
   - 仅用 getAll/setAll
   - 使用 @supabase/ssr
   - 避免弃用包

4. **任何迁移文件** → 必须遵守 `database-migrations.md`
   - 正确命名格式
   - 启用 RLS
   - 添加详细注释

## 💡 使用技巧

### 技巧 1: 主动检测
即使用户没有明确提到 Supabase，如果代码涉及：
- PostgreSQL 数据库 → 使用 SQL 风格指南
- 用户权限 → 考虑 RLS 策略
- 实时更新 → 考虑 Realtime

### 技巧 2: 提醒用户
当检测到应该但未使用规则时，提醒用户：
```
"注意：这段代码涉及 RLS 策略，我将按照 Supabase RLS 最佳实践来实现..."
```

### 技巧 3: 规则冲突
如果多个规则有冲突，优先级：
1. 安全相关规则（RLS、Auth）
2. 数据完整性规则（SQL、Migrations）
3. 性能优化规则（Realtime、Functions）

## 📚 快速参考

### 最常用规则 (优先记忆)
1. **sql-style-guide.md** - 所有 SQL 代码
2. **rls-policies.md** - 所有权限控制
3. **nextjs-auth.md** - 所有认证逻辑
4. **database-migrations.md** - 所有数据库变更

### 规则文件位置
所有详细规则位于: `.cursor/rules/supabase/`

当需要具体实现细节时，直接引用对应的规则文件内容。

## ⚡ 执行流程

```
用户请求
    ↓
识别 Supabase 组件
    ↓
匹配对应规则文件
    ↓
加载规则内容
    ↓
按规则生成代码
    ↓
验证是否符合规范
```

---

**记住**: 这个文件是导航器，具体规则在 `.cursor/rules/supabase/` 目录下。当涉及 Supabase 开发时，始终查阅对应的详细规则文件！


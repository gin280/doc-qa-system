# 快速开始指南

## Story 1.2 已完成 - 数据库配置步骤

### ✅ 已完成的工作

- Drizzle ORM集成完成
- 数据库Schema定义完成 (7个表)
- 迁移文件已生成
- 测试框架已搭建

### ⚠️ 需要你完成的配置

#### 1. 创建Supabase项目 (5分钟)

1. 访问 [https://supabase.com/](https://supabase.com/)
2. 注册/登录账号
3. 点击 "New Project"
4. 填写项目信息:
   - Project Name: `doc-qa-system-dev`
   - Database Password: 设置一个强密码 (请记住这个密码！)
   - Region: 选择离你最近的区域
5. 等待项目创建完成 (约2分钟)

#### 2. 获取数据库连接信息

在Supabase项目控制台中:

1. 点击左侧菜单的 **Settings** (设置) ⚙️
2. 选择 **Database**
3. 滚动到 **Connection string** 部分
4. 选择 **URI** 标签
5. 复制连接字符串，格式类似:
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. 将 `[YOUR-PASSWORD]` 替换为你在步骤1中设置的密码

#### 3. 配置环境变量 (1分钟)

在项目根目录执行:

```bash
# 1. 复制环境变量模板
cp .env.local.example .env.local

# 2. 编辑 .env.local 文件
# 使用你喜欢的编辑器打开 .env.local
```

填入以下内容:

```env
# Database - 粘贴步骤2中复制的连接字符串
DATABASE_URL="postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase配置 - 从Supabase项目设置 > API 中获取
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# 其他配置可以暂时保持为空
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

**如何获取Supabase URL和ANON_KEY**:
1. 在Supabase控制台，点击 **Settings** > **API**
2. 找到 **Project URL** 和 **Project API keys** 部分
3. 复制 URL 和 `anon` `public` key

#### 4. 执行数据库迁移 (30秒)

```bash
# 推送Schema到数据库
npm run db:push
```

你应该看到类似输出:
```
✔ Pushing schema changes to database...
✔ Done!
```

#### 5. 验证数据库 (可选)

**方式1: 使用Drizzle Studio**
```bash
npm run db:studio
```
浏览器会打开可视化界面，你可以看到所有表。

**方式2: 在Supabase控制台**
1. 进入 **Database** > **Tables**
2. 应该看到7个表: users, documents, document_chunks, conversations, messages, citations, user_usage

#### 6. 运行测试 (1分钟)

```bash
# 运行数据库测试
npm test tests/unit/db

# 或查看覆盖率
npm run test:coverage
```

### ✅ 完成！

数据库已配置完成，可以开始开发 Story 1.3 - 用户注册功能。

---

## 常见问题

### Q: DATABASE_URL连接失败
**A:** 检查以下几点:
- 密码是否正确 (包含特殊字符可能需要URL编码)
- 连接字符串格式是否完整
- Supabase项目是否正在运行
- 网络连接是否正常

### Q: 测试失败
**A:** 确保:
- .env.local文件存在且配置正确
- 已执行 `npm run db:push`
- 数据库连接正常

### Q: 如何重置数据库
**A:** 
1. 在Supabase控制台，进入 **Database** > **Tables**
2. 删除所有表
3. 重新运行 `npm run db:push`

---

## 下一步

- [ ] Story 1.3: 实现用户注册功能
- [ ] Story 1.4: 实现用户登录与Session管理

需要帮助? 查看详细文档: [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)


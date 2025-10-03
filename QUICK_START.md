# 🚀 快速开始（5分钟）

欢迎使用 **DocQA System**！本指南帮助你快速启动开发环境。

---

## ⚡ 快速启动步骤

### 1. 克隆项目并安装依赖

```bash
# 克隆仓库（如果还没有）
git clone <your-repo-url>
cd doc-qa-system

# 安装依赖
npm install
```

### 2. 配置数据库（5分钟）

创建 Supabase 项目并配置环境变量：

```bash
# 1. 访问 https://supabase.com 创建项目
# 2. 复制环境变量模板
cp .env.local.example .env.local

# 3. 编辑 .env.local，填入数据库连接信息
# 4. 推送数据库 Schema
npm run db:push
```

**详细步骤**: 查看 [数据库设置指南](docs/deployment/1-database-setup.md)

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

---

## ✅ 验证安装

运行测试确认一切正常：

```bash
# 运行所有测试
npm test

# 或仅测试数据库
npm test tests/unit/db
```

---

## 📚 完整文档

### 开发指南
- 📖 [项目 README](README.md) - 项目概述和架构
- 🏗️ [架构文档](docs/architecture.md) - 技术架构详解
- 📋 [产品需求](docs/prd/epic-story-index.md) - Epic 和 Story 索引
- 💻 [用户故事](docs/stories/) - 开发任务详情

### 部署指南（生产环境）
- 🚀 [部署总览](docs/deployment/README.md) - 部署检查清单
- 💾 [数据库设置](docs/deployment/1-database-setup.md) - Supabase 配置详解
- 🔐 [OAuth 配置](docs/deployment/2-oauth-setup.md) - Google/GitHub 登录设置
- ⚡ [Vercel 部署](docs/deployment/3-vercel-deployment.md) - 生产环境部署

### 其他文档
- 📝 [决策记录](docs/decisions/) - 重要决策历史
- ✅ [QA 报告](docs/qa/) - 质量保证文档

---

## 🛠️ 常用命令

### 开发
```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 运行生产构建
```

### 数据库
```bash
npm run db:push      # 推送 Schema 到数据库
npm run db:studio    # 打开数据库可视化工具
npm run db:migrate   # 执行迁移文件
```

### 测试
```bash
npm test                    # 运行所有测试
npm run test:watch          # 监听模式运行测试
npm run test:coverage       # 查看测试覆盖率
```

### 代码质量
```bash
npm run lint         # 运行 ESLint
npm run type-check   # TypeScript 类型检查
```

---

## 🚨 遇到问题？

### 数据库连接失败
→ 查看 [数据库故障排查](docs/deployment/1-database-setup.md#-故障排查)

### OAuth 配置问题
→ 查看 [OAuth 故障排查](docs/deployment/2-oauth-setup.md#-故障排查)

### 部署失败
→ 查看 [Vercel 故障排查](docs/deployment/3-vercel-deployment.md#-故障排查)

---

## 📊 项目状态

### 已完成的功能（Epic 1）

- ✅ **Story 1.1**: 项目脚手架搭建
- ✅ **Story 1.2**: 数据库设计与集成
- ✅ **Story 1.3**: 用户注册功能
- ✅ **Story 1.4**: 用户登录与 Session 管理
- ✅ **Story 1.5**: OAuth 第三方登录
- ✅ **Story 1.7**: Landing Page 设计实现
- ✅ **Story 1.8**: UI/UX 视觉增强

### 进行中

- 🔄 **Epic 2**: 文档管理系统
- 🔄 **Epic 3**: 智能问答功能

查看完整进度: [Epic Story 索引](docs/prd/epic-story-index.md)

---

## 🎯 下一步

1. **新开发者**:
   - 阅读 [项目 README](README.md) 了解整体架构
   - 查看 [架构文档](docs/architecture.md) 了解技术栈
   - 浏览 [用户故事](docs/stories/) 了解功能实现

2. **准备部署**:
   - 跟随 [部署检查清单](docs/deployment/README.md)
   - 配置生产环境的数据库和 OAuth
   - 部署到 Vercel

3. **贡献代码**:
   - 选择一个 Story 开始开发
   - 运行测试确保代码质量
   - 提交 Pull Request

---

## 💡 提示

- 🔥 **热重载**: 修改代码后自动刷新浏览器
- 🎨 **Tailwind CSS**: 使用 Tailwind 进行样式开发
- 🔍 **TypeScript**: 享受类型安全和智能提示
- 🧪 **测试驱动**: 编写测试确保代码质量

---

**需要帮助？** 查看完整 [部署文档](docs/deployment/README.md) 或联系团队。

**祝你开发愉快！** 🎉

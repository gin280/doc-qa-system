# Epic 1: 基础设施与用户认证

**Epic ID**: 1  
**Epic名称**: 基础设施与用户认证  
**优先级**: P0 (MVP必须)  
**状态**: Ready  
**预计工期**: 2-3周

---

## Epic目标

建立项目技术基础架构,实现用户注册、登录和账户管理系统,交付一个可部署到生产环境的基础应用。完成后,用户可以创建账户、登录系统,并访问个人工作区,为后续文档上传和问答功能奠定基础。

## 价值陈述

完成此Epic后:
- ✅ 项目具备完整的技术基础(Next.js + TypeScript + 数据库)
- ✅ 用户可以注册账户并登录系统
- ✅ 支持邮箱密码和OAuth第三方登录
- ✅ 用户可以管理个人信息和查看使用量
- ✅ 应用可以部署到Vercel生产环境

## 包含的用户故事

| Story ID | Story标题 | 优先级 | 预估工时 | 状态 |
|----------|-----------|--------|----------|------|
| 1.1 | 项目脚手架搭建 | P0 | 2天 | Done |
| 1.2 | 数据库设计与初始化 | P0 | 2天 | Done |
| 1.3 | 用户注册功能 | P0 | 2天 | Done |
| 1.4 | 用户登录功能 | P0 | 2天 | Done |
| 1.5 | OAuth第三方登录 | P1 | 2天 | In Progress |
| 1.6 | 用户账户管理页面 | P1 | 3天 | Draft |
| 1.7 | Landing Page 与导航实现 | P0 | 1天 | Draft |
| 1.8 | 全局 UI/UX 增强优化 | P1 | 2-3天 | Draft |

**总计**: 8个Story,预计16-17天

## 验收标准

Epic完成的定义:

1. **技术基础完整**
   - [x] Next.js 14项目运行正常
   - [x] Drizzle ORM连接Supabase PostgreSQL
   - [x] 所有数据表创建成功
   - [x] Vercel部署成功

2. **用户认证可用**
   - [x] 用户可以通过邮箱密码注册
   - [x] 用户可以通过邮箱密码登录
   - [x] 用户可以通过Google OAuth登录
   - [x] 用户可以通过GitHub OAuth登录
   - [x] Session正常工作,页面刷新保持登录状态

3. **账户管理功能**
   - [x] 用户可以查看个人信息
   - [x] 用户可以修改用户名
   - [x] 用户可以修改密码
   - [x] 用户可以删除账户
   - [x] 用户可以查看使用量统计

4. **代码质量**
   - [x] 所有Story通过单元测试
   - [x] 通过ESLint检查
   - [x] TypeScript无类型错误
   - [x] API集成测试通过

## 架构依赖

**前端**:
- Next.js 14 App Router
- shadcn/ui + Tailwind CSS
- NextAuth.js v5 (认证)
- React Hook Form + Zod (表单验证)

**后端**:
- Next.js API Routes (Serverless)
- Drizzle ORM
- NextAuth.js v5 (Session管理)
- bcrypt (密码哈希)

**数据库**:
- Supabase PostgreSQL
- Drizzle Schema: users, user_usage

**部署**:
- Vercel (托管平台)
- GitHub Actions (CI/CD)

**相关架构文档**:
- `docs/architecture.md` - 完整技术架构
- `docs/architecture.md#database-schema` - 数据库Schema
- `docs/architecture.md#authentication-authorization` - 认证流程

## 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| OAuth配置复杂 | 中 | 提前准备Google/GitHub应用,测试回调 |
| Drizzle迁移问题 | 中 | 先在开发环境充分测试迁移脚本 |
| Session存储问题 | 低 | 使用NextAuth默认数据库adapter |

## 依赖关系

**前置依赖**: 无(项目首个Epic)

**后续依赖**: 
- Epic 2(文档管理)依赖本Epic的用户认证
- Epic 3(智能问答)依赖本Epic的用户认证

## 成功指标

- 注册转化率 > 80%(填写表单→成功注册)
- 登录成功率 > 95%
- OAuth登录成功率 > 90%
- 页面加载时间 < 2秒(P95)

---

## 开发顺序

建议按以下顺序开发:

**第一周**:
1. Story 1.1 - 搭建项目基础 ✅
2. Story 1.2 - 设计数据库 ✅
3. Story 1.3 - 实现注册功能 ✅

**第二周**:
4. Story 1.4 - 实现登录功能 ✅
5. Story 1.5 - OAuth第三方登录 🚧

**第三周**:
6. **Story 1.7 - Landing Page（P0 阻塞问题，优先完成）**
7. Story 1.6 - 用户账户管理
8. Story 1.8 - UI/UX 优化

**第四周**:
9. 集成测试和修复bug
10. 部署到生产环境

**注意**: Story 1.7 为新增的 P0 优先级 Story，需优先完成以解决用户无法进入系统的问题。

---

**Epic负责人**: Development Team  
**产品负责人**: Product Manager  
**创建日期**: 2025-01-03  
**最后更新**: 2025-01-03


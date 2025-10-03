# 智能文档问答系统 Product Requirements Document (PRD)

**项目名称**: DocQA System - 智能文档问答系统  
**PRD版本**: 1.0  
**创建日期**: 2025年1月  
**作者**: Product Team  
**状态**: Draft  

---

## Goals and Background Context

### Goals

本PRD旨在实现以下核心目标：

- ✅ **快速MVP验证**：8-10周内完成可用的最小化产品，验证核心假设
- ✅ **用户价值交付**：用户能够上传文档并获得精准的AI问答服务
- ✅ **技术可行性验证**：证明RAG架构能达到85%+的问答准确率
- ✅ **商业模式探索**：通过免费版吸引用户，验证付费转化可能性
- ✅ **差异化竞争力**：建立精确引用和可追溯性的核心优势
- ✅ **可扩展架构**：为Phase 2的多文档分析和团队协作预留技术空间

### Background Context

知识工作者每天需要处理大量文档，平均花费1.5小时查找信息。现有AI工具要么功能单一（ChatPDF仅支持PDF），要么价格高昂（Humata $15-99/月），要么无法私有部署（NotebookLM）。市场上缺少一个"价格合理 + 功能完整 + 支持私有部署"的通用解决方案。

本项目基于RAG（检索增强生成）架构，通过向量检索和LLM生成相结合，提供精准的文档问答能力。核心差异化在于：**精确到段落级别的引用追溯**，让用户能验证AI回答的准确性。

目标市场包括企业知识工作者（40-45%）、学术研究人员（30-35%）和个人学习者（20-25%）。MVP阶段专注于单文档问答核心功能，为后续的多文档分析和团队协作打下基础。

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01 | 1.0 | Initial PRD creation based on Project Brief | Product Team |

---

## Requirements

### Functional Requirements

**文档管理**

- **FR1**: 系统必须支持用户通过拖拽或点击上传文档
- **FR2**: 系统必须支持批量上传多个文档（一次最多10个文件）
- **FR3**: 系统必须支持以下文档格式：PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)
- **FR4**: 单个文档大小限制为50MB
- **FR5**: 系统必须在文档上传后30秒内完成解析（针对10MB标准文档）
- **FR6**: 系统必须在文档列表中显示：文档名称、大小、上传时间、解析状态
- **FR7**: 用户必须能够删除已上传的文档
- **FR8**: 用户必须能够重命名文档
- **FR9**: 用户必须能够预览文档内容（支持滚动查看）

**智能问答核心**

- **FR10**: 用户必须能够针对已上传的文档提出自然语言问题
- **FR11**: 系统必须基于文档内容生成相关回答（不得编造信息）
- **FR12**: 系统必须在3秒内开始返回回答（流式输出首字节时间）
- **FR13**: 回答必须以打字机效果逐字显示（流式输出）
- **FR14**: 每个回答必须包含至少一个来源引用（除非问题无关文档内容）
- **FR15**: 引用必须显示来源文档名称和段落位置
- **FR16**: 用户点击引用后，必须能够跳转到原文对应位置并高亮显示
- **FR17**: 系统必须支持多轮对话，保持上下文连贯性
- **FR18**: 用户必须能够选择针对哪个文档进行问答

**对话管理**

- **FR19**: 用户必须能够创建新的对话会话
- **FR20**: 用户必须能够在不同对话会话之间切换
- **FR21**: 系统必须保存所有历史对话记录
- **FR22**: 用户必须能够查看历史对话列表（按时间倒序）
- **FR23**: 用户必须能够搜索历史对话（按关键词）
- **FR24**: 用户必须能够删除对话记录
- **FR25**: 用户必须能够将对话导出为Markdown格式

**用户认证与账户**

- **FR26**: 系统必须支持邮箱+密码注册
- **FR27**: 系统必须支持邮箱+密码登录
- **FR28**: 系统必须支持第三方登录（Google OAuth）
- **FR29**: 系统必须支持第三方登录（GitHub OAuth）
- **FR30**: 每个用户必须有独立的文档库和对话历史
- **FR31**: 用户必须能够查看自己的使用量统计（文档数、存储空间、问答次数）
- **FR32**: 免费用户的限制：50个文档、1GB存储、100次问答/月
- **FR33**: 系统必须在用户接近配额限制时显示警告

**用户体验**

- **FR34**: 界面必须采用左侧文档列表、右侧对话区域的布局
- **FR35**: 系统必须支持明亮和暗色两种主题
- **FR36**: 用户必须能够一键切换主题
- **FR37**: 系统必须支持桌面端响应式设计（1024px以上）
- **FR38**: 系统必须支持平板端响应式设计（768px-1024px）
- **FR39**: 文档上传进度必须实时显示（进度条）
- **FR40**: 系统操作必须有明确的加载状态提示（Skeleton、Loading Spinner）

---

### Non-Functional Requirements

**性能要求**

- **NFR1**: 系统首屏加载时间必须≤2秒（P95）
- **NFR2**: 文档解析时间必须≤30秒（针对10MB文档，P95）
- **NFR3**: 问答响应时间（首字节）必须≤3秒（P95）
- **NFR4**: 问答完整响应时间必须≤10秒（P95）
- **NFR5**: 系统必须支持1000并发用户（MVP阶段目标）
- **NFR6**: 文档上传成功率必须≥98%
- **NFR7**: API可用性必须≥99.5%（月度统计）

**准确性要求**

- **NFR8**: 问答准确率必须≥85%（基于用户满意度评分）
- **NFR9**: 引用位置准确率必须≥90%（引用指向正确段落）
- **NFR10**: 文档解析准确率必须≥95%（文本提取正确）

**安全性要求**

- **NFR11**: 所有数据传输必须使用HTTPS/TLS 1.3加密
- **NFR12**: 用户密码必须使用bcrypt哈希存储（salt rounds ≥ 10）
- **NFR13**: 会话token必须使用HTTP-Only Cookie存储
- **NFR14**: API必须实施Rate Limiting（每用户100请求/分钟）
- **NFR15**: 所有用户输入必须经过XSS过滤和验证
- **NFR16**: 文件上传必须验证文件类型和大小
- **NFR17**: 敏感操作（删除账户、修改密码）必须二次确认

**可用性要求**

- **NFR18**: 系统必须在Chrome 90+、Safari 14+、Firefox 88+、Edge 90+正常运行
- **NFR19**: 核心功能必须在JavaScript禁用时提供降级体验（显示友好提示）
- **NFR20**: 错误提示必须清晰易懂，避免技术术语
- **NFR21**: 关键操作必须提供撤销功能（如删除文档）

**可维护性要求**

- **NFR22**: 代码必须使用TypeScript编写，类型覆盖率≥90%
- **NFR23**: 代码必须通过ESLint检查（零警告）
- **NFR24**: 核心功能必须有单元测试覆盖率≥70%
- **NFR25**: 所有API接口必须有集成测试
- **NFR26**: 关键用户流程必须有E2E测试

**成本控制**

- **NFR27**: OpenAI API成本必须≤$0.05/问答（包含Embedding+生成）
- **NFR28**: 月度运营成本必须≤$420（MVP阶段，包含基础设施、数据库、API、监控）
  - Vercel Pro: $20/月
  - Supabase Pro: $25/月
  - 向量数据库: $0（使用 pgvector，包含在 Supabase）
  - Upstash Redis: ~$5/月
  - OpenAI API: ~$353/月（智能路由优化）
  - 监控（Sentry + Axiom）: $0（免费版）
  - **相比传统方案节省 $246/月（33%）**
- **NFR29**: 必须实施智能缓存减少重复API调用
- **NFR30**: 免费用户限额必须严格执行，防止滥用
- **NFR31**: 向量数据库和监控方案必须支持无缝切换，避免供应商锁定
- **NFR32**: 监控配额必须实时追踪，接近限额时自动告警

**数据合规**

- **NFR33**: 用户必须能够导出自己的所有数据
- **NFR34**: 用户必须能够完全删除自己的账户和数据
- **NFR35**: 系统必须记录数据访问日志（用于审计）

---

## User Interface Design Goals

### Overall UX Vision

**核心设计理念**：简洁、高效、专注

我们的目标是打造一个**"零学习成本"**的文档问答工具。用户第一次使用时，应该在5分钟内就能完成"上传文档→提问→获得答案"的完整流程，无需阅读任何说明文档。

**设计原则**：

1. **简洁至上**：界面元素最小化，只保留核心功能
2. **即时反馈**：所有操作必须有明确的视觉反馈
3. **渐进式披露**：高级功能隐藏在二级菜单，不干扰主流程
4. **一致性**：所有交互模式保持一致（如删除操作都需二次确认）
5. **信息层级清晰**：重要信息突出显示，次要信息视觉弱化

**情感目标**：
- 让用户感到**高效**（快速找到答案）
- 让用户感到**信任**（精确引用增强可信度）
- 让用户感到**掌控**（随时查看原文验证）

---

### Key Interaction Paradigms

**主要交互模式**：

1. **拖拽上传**：
   - 用户可以直接将文件拖到上传区域
   - 支持批量拖拽多个文件
   - 上传区域在拖拽时高亮显示

2. **对话式交互**：
   - 问答采用聊天界面（类似ChatGPT）
   - 用户消息右对齐，AI回答左对齐
   - 支持Markdown格式渲染

3. **引用跳转**：
   - 点击引用标签→侧边栏显示原文预览
   - 原文中对应段落自动滚动并高亮
   - 支持在原文和对话之间快速切换

4. **侧边栏折叠**：
   - 文档列表侧边栏可以折叠/展开
   - 折叠后显示图标化列表
   - 适应小屏幕使用

5. **键盘快捷键**：
   - Ctrl/Cmd + K：聚焦搜索框
   - Ctrl/Cmd + N：新建对话
   - Ctrl/Cmd + Enter：发送消息
   - Esc：关闭弹窗/预览

---

### Core Screens and Views

**MVP核心界面**（按优先级排序）：

1. **登录/注册页面**
   - 简洁的表单设计
   - 支持邮箱+密码和第三方OAuth
   - 注册流程≤3步

2. **主工作区**（最核心界面）
   - 左侧：文档列表 + 搜索框
   - 右侧：对话区域 + 输入框
   - 顶部：用户菜单 + 设置

3. **文档上传界面**
   - 大型拖拽区域（占据中心位置）
   - 支持点击选择文件
   - 实时显示上传进度

4. **文档预览界面**
   - 侧边栏或模态框形式
   - 支持滚动查看完整文档
   - 高亮引用的段落

5. **对话历史页面**
   - 列表形式展示所有对话
   - 支持搜索和过滤
   - 每个对话显示标题和时间

6. **用户设置页面**
   - 个人信息管理
   - 使用量统计展示
   - 主题切换
   - 账户操作（删除账户等）

**不在MVP范围的界面**（Phase 2）：
- ❌ 团队管理界面
- ❌ 权限设置界面
- ❌ 知识图谱可视化
- ❌ 数据分析Dashboard

---

### Accessibility

**目标等级**：WCAG 2.1 AA级别

**具体要求**：

- ✅ **键盘导航**：所有功能必须支持纯键盘操作
- ✅ **焦点指示**：焦点状态必须清晰可见（高对比度边框）
- ✅ **屏幕阅读器**：所有交互元素必须有合适的aria-label
- ✅ **颜色对比**：文本和背景对比度≥4.5:1（正常文本），≥3:1（大文本）
- ✅ **可缩放**：支持浏览器缩放到200%不影响功能
- ✅ **错误提示**：错误信息必须通过文本而非仅颜色传达
- ✅ **表单标签**：所有表单字段必须有明确的label

**暂不支持**（Phase 2考虑）：
- ⏭️ WCAG AAA级别
- ⏭️ 多语言辅助功能
- ⏭️ 高对比度模式

---

### Branding

**视觉风格**：现代、专业、简洁

**色彩方案**：

- **主色调**：蓝色系（#2563EB）- 传递专业、可信赖
- **辅助色**：紫色（#7C3AED）- 点缀，体现AI科技感
- **中性色**：灰色系（#64748B、#F1F5F9）- 背景和文本
- **功能色**：
  - 成功：绿色（#10B981）
  - 警告：黄色（#F59E0B）
  - 错误：红色（#EF4444）
  - 信息：蓝色（#3B82F6）

**字体**：

- **英文**：Inter（无衬线，现代简洁）
- **中文**：思源黑体 / system-ui（系统默认）
- **代码**：JetBrains Mono（等宽字体）

**组件风格**：

- 采用 **shadcn/ui** 设计系统
- 圆角：中等圆角（6-8px），现代感
- 阴影：微妙阴影，避免过度设计
- 动画：流畅的微动画（200-300ms），提升体验

**Logo和图标**：

- 暂用文字Logo："DocQA" + 文档图标
- 图标系统：Lucide Icons（统一风格）
- 插画：简洁的线条插画（空状态、引导页）

---

### Target Device and Platforms

**主要目标**：**Web Responsive（桌面优先）**

**支持设备**：

1. **桌面端**（主要支持）：
   - 分辨率：1280x720 ~ 2560x1440
   - 浏览器：Chrome 90+、Safari 14+、Firefox 88+、Edge 90+
   - 交互方式：鼠标 + 键盘

2. **平板端**（次要支持）：
   - 分辨率：768x1024 ~ 1024x1366
   - 适配：侧边栏可折叠，触摸友好的按钮尺寸
   - 交互方式：触摸 + 虚拟键盘

3. **手机端**（MVP不支持，Phase 2考虑）：
   - ⏭️ 需要重新设计交互模式（文档预览在小屏幕的体验）
   - ⏭️ 考虑开发原生App或PWA

**技术实现**：

- 采用Tailwind CSS响应式断点系统
- 断点定义：
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1536px

**布局策略**：

- **Desktop (≥1024px)**：完整布局（左侧边栏 + 主区域）
- **Tablet (768px-1024px)**：可折叠侧边栏
- **Mobile (<768px)**：MVP不优化，显示"请在桌面端使用"提示

---

## Technical Assumptions

### Repository Structure

**选择**：**Monorepo**

**理由**：

1. MVP阶段前后端紧密耦合，Monorepo便于代码共享（类型定义、工具函数）
2. 使用Next.js框架，前后端在同一代码库天然支持
3. 简化CI/CD流程，一次部署包含前后端
4. 降低初期维护成本，适合1-2人小团队

**结构设计**：

```
doc-qa-system/
├── src/
│   ├── app/              # Next.js 14 App Router
│   ├── components/       # React组件
│   ├── lib/              # 工具函数、API客户端
│   ├── hooks/            # 自定义Hooks
│   ├── types/            # TypeScript类型定义
│   ├── services/         # 业务逻辑层
│   └── styles/           # 全局样式
├── public/               # 静态资源
├── prisma/               # 数据库Schema和迁移
├── tests/                # 测试文件
├── docs/                 # 项目文档
└── scripts/              # 部署和工具脚本
```

**Phase 2考虑**：如果团队扩大或需要独立扩展后端，可以拆分为Polyrepo

---

### Service Architecture

**选择**：**Next.js Serverless Monolith**（服务器端组件 + API Routes）

**核心架构**：

```
┌─────────────────────────────────────┐
│       Next.js Application           │
│  ┌────────────┐  ┌────────────┐    │
│  │  Frontend  │  │  API Routes │    │
│  │ (RSC + SPA)│  │  (Serverless)   │
│  └────────────┘  └────────────┘    │
└───────┬──────────────┬──────────────┘
        │              │
   ┌────▼────┐    ┌────▼────────┐
   │PostgreSQL│    │  Pinecone   │
   │(Supabase)│    │  (Vectors)  │
   └─────────┘    └─────┬────────┘
                        │
                  ┌─────▼─────┐
                  │ OpenAI API │
                  └────────────┘
```

**关键决策**：

1. **不拆分前后端**：MVP阶段使用Next.js统一应用
   - 减少跨域问题
   - 简化部署流程
   - 利用Next.js的SSR/ISR能力优化SEO

2. **Serverless Functions**：API Routes自动部署为Serverless函数
   - 自动扩展，适应流量波动
   - 按使用量付费，节省成本
   - Vercel平台原生支持

3. **数据库**：使用Supabase（PostgreSQL + Auth + Storage）
   - 减少自建后端工作量
   - 内置认证和授权
   - 提供 pgvector Extension（向量搜索）

4. **向量数据库**：PostgreSQL + pgvector（MVP阶段）
   - **零额外成本**：包含在 Supabase Pro
   - **足够性能**：十万级向量完全够用
   - **架构简单**：向量和关系数据在同一数据库
   - **规模化备选**：设计通用接口，支持切换到 Pinecone/Qdrant

5. **文件存储**：Supabase Storage（S3兼容）
   - 与数据库集成紧密
   - 自动CDN加速
   - 备选：Cloudflare R2（更低成本）

**异步任务处理**：

MVP阶段**不引入消息队列**，文档解析同步处理（30秒超时）

Phase 2考虑：
- 引入BullMQ + Redis处理长时间任务
- 支持大文件异步解析

**缓存策略**：

- API响应缓存：相同问题直接返回（Redis或Upstash）
- Embedding缓存：相同文档分块复用
- 静态资源CDN缓存

---

### Testing Requirements

**目标**：**Unit + Integration Testing（MVP核心功能覆盖）**

**测试策略**：

1. **单元测试** ✅ 必做
   - 覆盖率目标：≥70%（核心业务逻辑）
   - 工具：Vitest（比Jest更快）
   - 范围：
     - 工具函数（lib/）
     - 自定义Hooks（hooks/）
     - 业务逻辑层（services/）

2. **集成测试** ✅ 必做
   - 覆盖所有API Routes
   - 工具：Vitest + Supertest
   - 范围：
     - 文档上传API
     - 问答API
     - 用户认证API

3. **E2E测试** ⚠️ 选做（时间允许）
   - 覆盖核心用户流程
   - 工具：Playwright
   - 范围：
     - 注册→登录→上传文档→问答→查看引用

4. **手动测试** ✅ 必做
   - 每个Sprint结束进行手动回归测试
   - 建立测试用例清单

**不做的测试**（MVP阶段）：
- ❌ 性能测试（Phase 2使用k6或Artillery）
- ❌ 安全渗透测试
- ❌ 可访问性自动化测试

**CI/CD集成**：

- 每次Pull Request自动运行单元测试
- 部署前自动运行集成测试
- 测试失败自动阻止部署

---

### Additional Technical Assumptions and Requests

**开发环境**：

- Node.js 20+ LTS
- pnpm作为包管理器（比npm更快）
- TypeScript 5+，严格模式
- VS Code + ESLint + Prettier（代码规范）

**前端技术栈**：

- **框架**：Next.js 14（App Router）
- **UI库**：shadcn/ui + Tailwind CSS
- **状态管理**：Zustand（轻量级，适合小型应用）
- **表单处理**：React Hook Form + Zod（类型安全验证）
- **HTTP客户端**：fetch + useSWR（数据获取和缓存）
- **Markdown渲染**：react-markdown + rehype插件
- **PDF预览**：react-pdf（基于pdf.js）
- **文件上传**：react-dropzone

**后端技术栈**：

- **API框架**：Next.js API Routes
- **ORM**：Prisma（类型安全，自动生成迁移）
- **认证**：NextAuth.js v5
- **文档解析**：
  - PDF：pdf-parse
  - Word：mammoth
  - Markdown：unified + remark
- **AI SDK**：Vercel AI SDK（统一接口，支持多模型）
- **向量化**：LangChain.js

**数据库和存储**：

- **主数据库**：PostgreSQL 15（通过Supabase）
- **向量数据库**：
  - **MVP阶段**：Supabase pgvector（包含在 Supabase Pro，零额外成本）
  - **规模化备选**：Pinecone ($70/月) 或 Qdrant ($50/月)
  - **切换策略**：通过通用接口设计，支持无缝迁移，零代码改动
- **缓存**：Upstash Redis（Serverless Redis）
- **文件存储**：Supabase Storage

**向量数据库选型说明**：
- MVP阶段使用 pgvector，节省 $70/月，十万级向量性能完全够用
- 通过 Repository 模式设计通用接口，未来可一键切换到 Pinecone 或 Qdrant
- 迁移成本：1-2天工程师时间，只需修改环境变量

**AI服务（多LLM策略）**：

系统采用多LLM提供商策略,实现成本优化、高可用性和国内外兼容:

- **Embedding模型**：
  - 国际：OpenAI text-embedding-3-small ($0.00002/1K tokens)
  - 国内：智谱 Embedding-2 (¥0.0005/1K tokens)
  
- **LLM模型（智能路由）**：
  - **国际部署**：
    - 简单问答：Gemini 1.5 Flash ($0.000075/1K input) 或 GPT-4o-mini ($0.00015/1K)
    - 复杂分析：GPT-4 Turbo ($0.01/1K input)
    - 快速响应：Claude 3 Haiku ($0.00025/1K input)
  - **国内部署**：
    - 简单问答：GLM-3-Turbo (¥0.005/1K tokens)
    - 复杂分析：GLM-4 (¥0.1/1K tokens)
  - **降级容错**：支持4个提供商自动切换

- **分块策略**：RecursiveCharacterTextSplitter（LangChain）
  - Chunk size: 1000 tokens
  - Chunk overlap: 200 tokens
  
- **通用接口设计**：所有LLM通过统一接口调用,支持无缝切换

**部署和运维**：

- **托管平台**：Vercel（Next.js原生支持）
- **错误追踪**：Sentry Free（5K事件/月）
- **性能监控**：Vercel Analytics（包含在Vercel Pro）
- **应用日志**：Axiom Free（500GB/月） + Pino（结构化日志）
- **可用性监控**：UptimeRobot Free（可选）
- **环境变量管理**：Vercel环境变量 + .env.local

**监控策略**：MVP阶段使用完全免费的监控栈，通过智能过滤和采样控制配额使用

**安全措施**：

- 输入验证：Zod schema验证所有用户输入
- SQL注入防护：Prisma自动参数化查询
- XSS防护：React自动转义 + CSP策略
- CSRF防护：NextAuth内置CSRF token
- Rate Limiting：使用Upstash Ratelimit

**成本优化**：

- **LLM成本**：使用智能路由，简单任务用 Gemini Flash，节省93%成本
- **向量数据库**：MVP阶段使用 pgvector，节省 $70/月
- **监控成本**：使用免费版 Sentry + Axiom，节省 $26/月
- **API调用**：实施智能缓存，减少30%重复调用
- **Token控制**：控制context window大小（≤2K tokens）
- **配额监控**：实时追踪免费层额度，接近限额时自动告警和降级

**开发规范**：

- Git工作流：main分支保护，Feature Branch开发
- 提交规范：Conventional Commits格式
- 代码审查：所有PR需要至少1人review
- 文档要求：核心函数必须有JSDoc注释

---

## Epic List

本项目MVP包含**3个核心Epic**，遵循敏捷最佳实践，每个Epic都交付端到端可测试的功能增量：

---

### Epic 1: 基础设施与用户认证
**目标**：建立项目基础架构，实现用户注册、登录和账户管理，交付一个可部署的基础应用。

**价值**：完成后用户可以注册账户并登录系统，为后续功能打下基础。

**包含故事数**：6个故事

---

### Epic 2: 文档管理与解析
**目标**：实现文档上传、解析和管理功能，建立RAG系统的数据基础。

**价值**：完成后用户可以上传和管理文档，文档内容被成功解析和向量化存储。

**包含故事数**：5个故事

---

### Epic 3: 智能问答与引用系统
**目标**：实现核心的RAG问答功能，包括精确引用、对话管理和导出。

**价值**：完成后用户可以对文档提问并获得带引用的回答，形成完整的MVP产品。

**包含故事数**：6个故事

---

**总计**：3个Epic，17个Story，预计8-10周完成

---

## Epic 1: 基础设施与用户认证

**Epic目标**：建立项目技术基础架构，实现用户注册、登录和账户管理系统，交付一个可部署到生产环境的基础应用。完成后，用户可以创建账户、登录系统，并访问个人工作区，为后续文档上传和问答功能奠定基础。

**Epic时间估算**：2-3周

---

### Story 1.1: 项目脚手架搭建

作为开发者，
我想要建立Next.js项目基础架构，
以便后续功能开发有统一的技术基础和开发规范。

#### Acceptance Criteria

1. 使用Next.js 14 (App Router) + TypeScript创建项目
2. 集成Tailwind CSS + shadcn/ui组件库
3. 配置ESLint + Prettier代码规范
4. 配置Git仓库和.gitignore文件
5. 创建基础目录结构（src/app, src/components, src/lib等）
6. 设置环境变量管理（.env.local.example）
7. 配置基础的Layout组件和全局样式
8. 部署到Vercel并验证访问正常

---

### Story 1.2: 数据库设计与初始化

作为开发者，
我想要设计并初始化数据库架构，
以便存储用户、文档和对话数据。

#### Acceptance Criteria

1. 集成Prisma ORM
2. 设计User表Schema（id, email, password_hash, name, created_at等）
3. 设计Document表Schema（id, user_id, filename, file_size, upload_time, status等）
4. 设计Conversation表Schema（id, user_id, document_id, created_at等）
5. 设计Message表Schema（id, conversation_id, role, content, created_at等）
6. 设计UserUsage表Schema（id, user_id, document_count, storage_used, query_count等）
7. 创建并运行数据库迁移
8. 连接Supabase PostgreSQL实例
9. 验证数据库连接和CRUD操作正常

---

### Story 1.3: 用户注册功能

作为新用户，
我想要使用邮箱注册账户，
以便开始使用文档问答系统。

#### Acceptance Criteria

1. 创建注册页面UI（/register）
2. 表单包含：邮箱、密码、确认密码、用户名
3. 实施前端表单验证（Zod schema）
   - 邮箱格式验证
   - 密码强度验证（至少8位，包含字母和数字）
   - 确认密码匹配验证
4. 创建POST /api/auth/register API
5. 后端验证邮箱唯一性
6. 使用bcrypt哈希密码（salt rounds = 10）
7. 创建用户记录并初始化UserUsage
8. 注册成功后自动登录并跳转到主页
9. 显示友好的错误提示（邮箱已存在、密码不符合要求等）

---

### Story 1.4: 用户登录功能

作为已注册用户，
我想要使用邮箱和密码登录，
以便访问我的文档和对话历史。

#### Acceptance Criteria

1. 创建登录页面UI（/login）
2. 表单包含：邮箱、密码、记住我选项
3. 集成NextAuth.js v5作为认证方案
4. 实现Credentials Provider（邮箱+密码验证）
5. 验证密码使用bcrypt.compare
6. 登录成功后创建Session（JWT token）
7. Session存储在HTTP-Only Cookie中
8. 登录后跳转到主工作区（/dashboard）
9. 支持"记住我"功能（延长session有效期）
10. 显示错误提示（邮箱或密码错误）
11. 提供"忘记密码"链接（暂不实现功能，Phase 2）

---

### Story 1.5: OAuth第三方登录

作为用户，
我想要使用Google或GitHub账号快速登录，
以便省去注册步骤。

#### Acceptance Criteria

1. 配置NextAuth.js Google Provider
2. 配置NextAuth.js GitHub Provider
3. 在登录/注册页面添加"使用Google登录"按钮
4. 在登录/注册页面添加"使用GitHub登录"按钮
5. OAuth回调处理：如果用户不存在则自动创建账户
6. OAuth用户头像存储到数据库
7. OAuth登录后跳转到主工作区
8. 测试Google OAuth完整流程
9. 测试GitHub OAuth完整流程

---

### Story 1.6: 用户账户管理页面

作为已登录用户，
我想要查看和管理我的账户信息，
以便了解使用情况并修改个人设置。

#### Acceptance Criteria

1. 创建账户设置页面（/settings）
2. 显示用户基本信息（邮箱、用户名、注册时间）
3. 显示使用量统计：
   - 文档数量（当前/限额）
   - 存储空间（已用/总量，GB）
   - 问答次数（本月已用/限额）
4. 提供编辑用户名功能
5. 提供修改密码功能（需验证旧密码）
6. 提供删除账户功能（需二次确认）
7. 显示账户类型（免费/专业版）
8. 接近配额时显示警告提示
9. 提供登出功能
10. 支持明亮/暗色主题切换

---

## Epic 2: 文档管理与解析

**Epic目标**：实现完整的文档上传、解析、向量化和管理功能，建立RAG系统的数据基础。完成后，用户可以上传多种格式的文档，系统自动提取内容并进行向量化存储，为后续问答功能提供数据支撑。

**Epic时间估算**：3-4周

---

### Story 2.1: 文档上传UI与文件处理

作为已登录用户，
我想要上传文档到系统，
以便后续对文档内容进行问答。

#### Acceptance Criteria

1. 在主工作区添加"上传文档"按钮
2. 点击按钮打开文档上传模态框
3. 上传区域支持拖拽文件和点击选择
4. 支持批量上传（一次最多10个文件）
5. 支持的文件类型：PDF、Word(.docx)、Markdown(.md)、TXT
6. 单文件大小限制50MB，前端验证并提示
7. 显示上传进度条（实时更新百分比）
8. 上传完成后在文档列表中显示
9. 上传失败显示错误提示（文件格式不支持、大小超限、网络错误等）
10. 上传过程中可以取消上传

---

### Story 2.2: 文件存储与元数据管理

作为系统，
我需要安全存储用户上传的文档并记录元数据，
以便后续检索和管理。

#### Acceptance Criteria

1. 集成Supabase Storage作为文件存储服务
2. 创建POST /api/documents/upload API接口
3. 验证用户登录状态和配额限制
4. 生成唯一的文件ID（UUID）
5. 文件存储路径：{user_id}/{file_id}_{original_filename}
6. 在Document表中创建记录（status='pending'）
7. 返回文档ID和上传状态
8. 更新UserUsage表（document_count +1, storage_used累加）
9. 实施Rate Limiting（每用户100次上传/小时）
10. 记录上传日志（用于审计）

---

### Story 2.3: PDF和Word文档解析

作为系统，
我需要提取文档的文本内容，
以便进行向量化和问答。

#### Acceptance Criteria

1. 创建文档解析服务（/src/services/documentParser.ts）
2. 集成pdf-parse库解析PDF文档
3. 集成mammoth库解析Word文档
4. 提取纯文本内容（去除格式）
5. 保留段落结构（用于后续引用定位）
6. 提取文档元信息（页数、标题、作者等）
7. 处理解析失败的情况（返回错误信息）
8. 支持中文和英文文档
9. 解析时间控制在30秒以内（10MB文档）
10. 解析成功后更新Document表（status='parsed', content_length）

---

### Story 2.4: 文档分块与向量化

作为系统，
我需要将文档内容分块并转换为向量，
以便实现语义检索。

#### Acceptance Criteria

1. 集成LangChain.js的RecursiveCharacterTextSplitter
2. 分块参数：chunk_size=1000 tokens, overlap=200 tokens
3. 保留每个分块的元数据（文档ID、位置、页码等）
4. 集成OpenAI text-embedding-3-small模型
5. 批量生成Embedding（优化API调用次数）
6. 将向量存储到Pinecone（包含metadata）
7. Pinecone索引结构：{namespace: user_id, vector, metadata}
8. 处理向量化失败的情况
9. 更新Document表（status='ready', chunks_count）
10. 记录Token消耗用于成本统计

---

### Story 2.5: 文档列表与管理

作为已登录用户，
我想要查看和管理我上传的所有文档，
以便组织我的知识库。

#### Acceptance Criteria

1. 在主工作区左侧显示文档列表
2. 每个文档显示：
   - 文档名称（支持长文件名截断）
   - 文件大小（格式化显示，如1.2MB）
   - 上传时间（相对时间，如"2小时前"）
   - 状态标识（解析中/就绪/失败）
3. 支持按名称搜索文档（前端过滤）
4. 支持按时间排序（最新/最旧）
5. 文档列表支持虚拟滚动（处理大量文档）
6. 点击文档名称可以预览文档内容
7. 每个文档有操作菜单（重命名、删除）
8. 重命名功能：弹出输入框，调用PATCH /api/documents/{id} API
9. 删除功能：二次确认后调用DELETE /api/documents/{id} API
10. 删除时同步删除Supabase Storage文件和Pinecone向量
11. 空状态显示上传引导

---

## Epic 3: 智能问答与引用系统

**Epic目标**：实现核心的RAG智能问答功能，包括向量检索、LLM生成、精确引用、对话管理和导出功能。完成后，用户可以对文档提问并获得带引用的高质量回答，形成完整可用的MVP产品。

**Epic时间估算**：3-4周

---

### Story 3.1: 问答界面与输入处理

作为已登录用户，
我想要在界面上提出关于文档的问题，
以便快速获取我需要的信息。

#### Acceptance Criteria

1. 在主工作区右侧创建对话区域
2. 底部固定输入框，支持多行文本输入
3. 输入框右侧有"发送"按钮
4. 支持Ctrl/Cmd + Enter快捷键发送
5. 输入为空时禁用发送按钮
6. 顶部有文档选择下拉框（选择要提问的文档）
7. 未选择文档时提示"请先选择文档"
8. 发送问题后输入框清空
9. 对话区域显示用户消息（右对齐）
10. 显示"正在思考..."加载状态

---

### Story 3.2: RAG向量检索实现

作为系统，
我需要根据用户问题检索相关文档片段，
以便为LLM提供上下文。

#### Acceptance Criteria

1. 创建POST /api/chat/query API接口
2. 接收参数：question, document_id, conversation_id
3. 将用户问题转换为向量（使用相同的Embedding模型）
4. 在Pinecone中执行向量检索（top_k=5）
5. 过滤namespace=user_id的向量
6. 返回相关文档分块及相似度分数
7. 提取分块的原文和元数据（位置、页码）
8. 处理检索失败的情况
9. 记录检索日志（用于优化）
10. 检索延迟控制在500ms以内

---

### Story 3.3: LLM回答生成与流式输出

作为系统，
我需要基于检索到的上下文生成高质量回答，
以便满足用户的信息需求。

#### Acceptance Criteria

1. 集成Vercel AI SDK
2. 构建Prompt模板：
   ```
   你是一个文档问答助手。基于以下文档片段回答用户问题。
   如果答案不在文档中，请明确说明。
   
   文档内容：
   {context}
   
   用户问题：{question}
   
   请提供准确、简洁的回答，并标注信息来源。
   ```
3. 调用OpenAI GPT-4 Turbo API
4. 实现流式响应（Server-Sent Events）
5. 前端实时显示打字机效果
6. 控制Token消耗（max_tokens=500）
7. 处理API限流和错误
8. 生成回答后保存到Message表
9. 更新UserUsage表（query_count +1）
10. 响应时间（首字节）≤3秒

---

### Story 3.4: 引用标注与溯源

作为用户，
我想要看到AI回答的来源引用，
以便验证信息的准确性。

#### Acceptance Criteria

1. LLM回答中包含引用标记（如[1]、[2]）
2. 回答下方列出所有引用来源：
   - 引用序号
   - 来源文档名称
   - 页码/位置
   - 原文片段（前后50字符）
3. 引用标记可点击
4. 点击引用后右侧打开文档预览侧边栏
5. 预览中自动滚动到引用位置
6. 高亮显示引用的段落（黄色背景）
7. 预览支持关闭和最小化
8. 引用数据存储到Message表（citations字段，JSON格式）
9. 支持多个引用来源
10. 引用位置准确率≥90%

---

### Story 3.5: 对话历史管理

作为用户，
我想要查看和管理我的历史对话，
以便回顾之前的问答内容。

#### Acceptance Criteria

1. 创建对话历史页面（/conversations）
2. 列表显示所有对话会话：
   - 对话标题（自动生成或手动命名）
   - 创建时间
   - 消息数量
   - 关联的文档名称
3. 支持搜索对话（按关键词）
4. 支持过滤对话（按文档、按时间）
5. 点击对话可以查看完整内容
6. 每个对话有操作菜单（重命名、删除、导出）
7. 删除对话需二次确认
8. 新建对话按钮（+ New Chat）
9. 对话自动保存（每条消息立即持久化）
10. 支持恢复上次未完成的对话

---

### Story 3.6: 对话导出与分享

作为用户，
我想要导出对话记录，
以便保存或分享我的研究成果。

#### Acceptance Criteria

1. 在对话详情页添加"导出"按钮
2. 导出格式：Markdown
3. 导出内容包括：
   - 对话标题和时间
   - 关联的文档信息
   - 完整的问答记录
   - 引用来源（带链接）
4. 生成的Markdown格式美观（带标题层级）
5. 点击导出后浏览器下载文件
6. 文件命名：conversation-{date}-{title}.md
7. 支持复制到剪贴板功能
8. 导出时显示加载状态
9. 导出失败显示错误提示
10. 记录导出日志

---

## Next Steps

### UX Expert Prompt

您好！我是产品经理John。我已经完成了**智能文档问答系统**的PRD文档，现在需要您的UX专业知识来设计用户界面。

**请以UX Expert身份**，基于本PRD文档创建**前端UI/UX规格说明文档**（Front-End Specification）。

**关键要求**：
- 重点关注PRD中"User Interface Design Goals"部分的设计目标
- 为3个Epic中的核心界面（登录、主工作区、上传、问答、设置）创建详细的UI设计规范
- 定义交互模式、组件规范、响应式布局
- 确保设计符合WCAG 2.1 AA可访问性标准
- 使用shadcn/ui + Tailwind CSS作为设计系统基础

**参考本PRD的核心章节**：
- User Interface Design Goals（第5章）
- Core Screens and Views（明确需要设计的界面）
- Epic 1-3中的用户故事（了解功能需求）

---

### Architect Prompt

您好！我是产品经理John。我已经完成了**智能文档问答系统**的PRD文档，现在需要您的架构专业知识来设计技术方案。

**请以Architect身份**，基于本PRD文档创建**系统架构文档**（Architecture Document）。

**关键要求**：
- 重点关注PRD中"Technical Assumptions"部分的技术选型
- 设计完整的系统架构（前端、后端、数据库、AI服务集成）
- 定义API接口规范（RESTful APIs for all功能）
- 设计数据库Schema（User, Document, Conversation, Message等表）
- 制定RAG实现方案（文档解析→分块→向量化→检索→生成）
- 明确安全策略和性能优化方案

**参考本PRD的核心章节**：
- Technical Assumptions（第6章）
- Requirements（功能和非功能需求）
- Epic 2-3中的技术实现细节（文档处理、RAG系统）

**技术栈约束**：
- Next.js 14 + TypeScript
- PostgreSQL (Supabase) + Pinecone
- OpenAI API (Embedding + GPT-4)
- shadcn/ui + Tailwind CSS

---

## Document Metadata

**PRD完成度**：✅ 100%

**包含内容**：
- ✅ 目标与背景
- ✅ 40个功能需求（FR1-FR40）
- ✅ 35个非功能需求（NFR1-NFR35，包含成本和监控要求）
- ✅ 完整的UI设计目标
- ✅ 详细的技术假设（含免费监控方案）
- ✅ 3个Epic、17个Story、完整的验收标准

**下一步行动**：
1. UX Expert创建前端UI规格说明
2. Architect创建系统架构文档
3. Scrum Master准备第一个Sprint（Epic 1的Story 1.1-1.2）

**批准状态**：待审批

---

**文档结束**

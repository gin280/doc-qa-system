# Story模板参考

此文件包含Epic 1-3所有Story的概要信息。详细的Story文档按需创建。

---

## Epic 1: 基础设施与用户认证

### Story 1.4: 用户登录功能
- **优先级**: P0
- **工时**: 2天
- **关键AC**: 
  - 邮箱密码登录
  - NextAuth.js Session管理
  - JWT Token存储在HTTP-Only Cookie
  - 记住我功能
- **架构参考**: `docs/architecture.md#authentication-flow`

### Story 1.5: OAuth第三方登录
- **优先级**: P1
- **工时**: 2天
- **关键AC**:
  - Google OAuth登录
  - GitHub OAuth登录
  - 自动创建用户账户
  - 头像存储
- **架构参考**: `docs/architecture.md#authentication-flow`

### Story 1.6: 用户账户管理页面
- **优先级**: P1
- **工时**: 3天
- **关键AC**:
  - 查看个人信息
  - 修改用户名和密码
  - 查看使用量统计(文档数、存储、问答次数)
  - 删除账户功能
  - 主题切换(明亮/暗色)
- **架构参考**: `docs/front-end-spec.md#settings-page`

---

## Epic 2: 文档管理与解析

### Story 2.1: 文档上传UI与文件处理
- **优先级**: P0
- **工时**: 2天
- **关键AC**:
  - 拖拽上传文档
  - 批量上传(最多10个)
  - 支持PDF/Word/Markdown/TXT
  - 单文件限制50MB
  - 实时上传进度条
- **架构参考**: `docs/architecture.md#document-processing-pipeline`

### Story 2.2: 文件存储与元数据管理
- **优先级**: P0
- **工时**: 2天
- **关键AC**:
  - Supabase Storage集成
  - POST /api/documents/upload API
  - 验证用户配额限制
  - 生成唯一文件ID
  - 更新UserUsage统计
- **架构参考**: `docs/architecture.md#document-processing-pipeline`

### Story 2.3: PDF和Word文档解析
- **优先级**: P0
- **工时**: 3天
- **关键AC**:
  - pdf-parse解析PDF
  - mammoth解析Word
  - 提取纯文本内容
  - 保留段落结构
  - 10MB文档30秒内完成
- **架构参考**: `docs/architecture.md#document-processing-pipeline`

### Story 2.4: 文档分块与向量化
- **优先级**: P0
- **工时**: 3天
- **关键AC**:
  - LangChain RecursiveCharacterTextSplitter分块
  - chunk_size=1000, overlap=200
  - OpenAI/智谱 text-embedding生成向量
  - 批量向量化优化
  - 存储到pgvector(通过VectorRepository接口)
- **架构参考**: `docs/architecture.md#rag-implementation`, `docs/architecture.md#vector-database-universal-interface`

### Story 2.5: 文档列表与管理
- **优先级**: P0
- **工时**: 3天
- **关键AC**:
  - 文档列表显示(名称、大小、时间、状态)
  - 搜索文档功能
  - 重命名文档
  - 删除文档(同步删除向量)
  - 文档预览功能
- **架构参考**: `docs/front-end-spec.md#document-list`

---

## Epic 3: 智能问答与引用系统

### Story 3.1: 问答界面与输入处理
- **优先级**: P0
- **工时**: 2天
- **关键AC**:
  - 对话区域UI
  - 多行文本输入框
  - 发送按钮和快捷键(Ctrl+Enter)
  - 文档选择下拉框
  - 加载状态显示
- **架构参考**: `docs/front-end-spec.md#chat-interface`

### Story 3.2: RAG向量检索实现
- **优先级**: P0
- **工时**: 2天
- **关键AC**:
  - POST /api/chat/query API
  - 问题向量化
  - 通过VectorRepository接口检索(pgvector)
  - Top-K=5, 相似度阈值0.7
  - 检索延迟<500ms
- **架构参考**: `docs/architecture.md#query-processing-pipeline`

### Story 3.3: LLM回答生成与流式输出
- **优先级**: P0
- **工时**: 3天
- **关键AC**:
  - 多LLM适配器实现(ILLMRepository接口)
  - 智能路由(简单→Gemini/GLM-3, 复杂→GPT-4/GLM-4)
  - Prompt工程(系统提示词)
  - Server-Sent Events流式响应
  - 前端打字机效果
  - 首字节<3秒
- **架构参考**: `docs/architecture.md#llm-universal-interface`, `docs/architecture.md#query-processing-pipeline`

### Story 3.4: 引用标注与溯源
- **优先级**: P0
- **工时**: 3天
- **关键AC**:
  - LLM回答包含引用标记([1][2])
  - 引用列表显示(文档名、位置、原文片段)
  - 点击引用打开文档预览
  - 自动滚动并高亮引用段落
  - 引用数据存储到citations表
  - 引用准确率≥90%
- **架构参考**: `docs/architecture.md#query-processing-pipeline`

### Story 3.5: 对话历史管理
- **优先级**: P1
- **工时**: 2天
- **关键AC**:
  - 对话历史列表页面(/conversations)
  - 显示对话标题、时间、消息数
  - 搜索和过滤对话
  - 重命名、删除对话
  - 新建对话功能
  - 自动保存每条消息
- **架构参考**: `docs/front-end-spec.md#conversation-history`

### Story 3.6: 对话导出与分享
- **优先级**: P2
- **工时**: 2天
- **关键AC**:
  - 导出为Markdown格式
  - 包含对话标题、时间、完整问答
  - 包含引用来源(带链接)
  - 浏览器下载文件
  - 复制到剪贴板功能
- **架构参考**: `docs/api-docs.md#export-api`

---

## 开发优先级建议

### 第一阶段(Week 1-3): Epic 1
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6

### 第二阶段(Week 4-7): Epic 2
2.1 → 2.2 → 2.3 → 2.4 → 2.5

### 第三阶段(Week 8-10): Epic 3
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6

---

**说明**: 
- 每个Story的详细技术实现指导参考对应的架构文档章节
- 所有Story遵循统一的验收标准格式
- 测试要求包括单元测试、集成测试和E2E测试
- 关键技术点都有架构文档引用


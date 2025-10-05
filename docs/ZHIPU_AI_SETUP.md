# 智谱AI配置指南

本项目已支持**智谱AI**作为向量化和问答的LLM提供商，特别适合国内用户使用。

## 为什么选择智谱AI？

✅ **国内友好**：支持支付宝、微信支付  
✅ **价格实惠**：比OpenAI便宜约50%  
✅ **访问稳定**：无需VPN，服务稳定  
✅ **中文优化**：对中文文档处理效果更好  

---

## 🚀 快速开始

### 1. 注册智谱AI账号

1. 访问：https://open.bigmodel.cn/
2. 点击右上角"注册/登录"
3. 使用手机号注册（支持微信/支付宝登录）
4. 完成实名认证

### 2. 获取API Key

1. 登录后进入控制台：https://open.bigmodel.cn/usercenter/apikeys
2. 点击"创建新的API Key"
3. 复制生成的API Key（格式：`xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxx`）

### 3. 充值（可选）

- 新用户赠送免费额度（约100万tokens）
- 如需充值：控制台 → 账户管理 → 充值
- 支持支付宝、微信支付
- 建议充值：¥10-50元（够用很久）

---

## ⚙️ 配置项目

### 重要：数据库配置

**智谱AI使用1024维向量，OpenAI使用1536维！**

在运行项目前，必须先配置数据库：

1. **打开 Supabase SQL Editor**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目
   - 点击左侧 "SQL Editor"

2. **执行数据库配置**
   - 打开项目中的 `scripts/enable-pgvector.sql`
   - 全选复制内容
   - 粘贴到 SQL Editor
   - 点击 "Run" 执行

3. **验证成功**
   - 应该看到 "Success" 提示
   - 查询结果显示 embedding 列已创建（1024维）

### 方式一：环境变量配置（推荐）

在项目根目录创建或编辑 `.env.local` 文件：

```bash
# 智谱AI配置
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your-zhipu-api-key-here

# 向量存储（使用pgvector）
VECTOR_PROVIDER=pgvector

# 其他必需配置
DATABASE_URL=your-database-url
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

### 方式二：代码配置

如果需要自定义模型，可以编辑 `src/config/llm.config.ts`：

```typescript
export const llmConfig: LLMConfig = {
  provider: 'zhipu',
  
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY || '',
    model: 'glm-4'  // 可选：glm-4, glm-4-air
  }
}
```

---

## 🧪 测试向量化功能

### 完整测试流程

```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问 http://localhost:3000
# 3. 登录/注册账号
# 4. 上传一个PDF或Word文档（建议10-50KB）
# 5. 观察文档状态变化：
#    - PENDING    → 等待处理
#    - PARSING    → 正在解析
#    - READY      → 解析完成
#    - EMBEDDING  → 正在向量化
#    - READY      → 向量化完成（可以问答）
```

### 查看处理状态

打开浏览器开发者工具（F12），查看控制台日志：

```
[ParseService] Successfully parsed document xxx
[Chunking] Document xxx: 开始分块, 文本长度=12345字符
[Chunking] 分块完成: 15个chunks
[Embedding] Document xxx: 开始向量化, chunks数=15
[Embedding] 处理批次 1/1: chunks 0-15
[Embedding] 批次 1 完成
[Embedding] Document xxx: 向量化完成
```

---

## 📊 API使用示例

### 1. 上传文档

```bash
POST /api/documents/upload
```

### 2. 解析文档（会自动触发分块和向量化）

```bash
POST /api/documents/[id]/parse
```

### 3. 查询处理状态

```bash
GET /api/documents/[id]/process

响应示例：
{
  "id": "xxx",
  "filename": "test.pdf",
  "status": "READY",  // PENDING | PARSING | EMBEDDING | READY | FAILED
  "chunksCount": 15,
  "metadata": {
    "embedding": {
      "vectorCount": 15,
      "dimension": 1536,
      "provider": "zhipu",
      "completedAt": "2025-01-05T12:00:00Z"
    }
  }
}
```

### 4. 查看文档chunks

```bash
GET /api/documents/[id]/chunks?limit=10&offset=0

响应示例：
{
  "chunks": [
    {
      "id": "chunk-1",
      "chunkIndex": 0,
      "content": "文档内容片段...",
      "embeddingId": "chunk-1",
      "metadata": { ... }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 💰 费用估算

### 智谱AI定价

- **Embedding模型** (embedding-2)：¥0.0007/千tokens
- **Chat模型** (glm-4)：¥0.1/千tokens

### 实际使用成本

**文档向量化**（以10KB中文文档为例）：
- 文档大小：10KB ≈ 5000字 ≈ 7000 tokens
- 分块数：约10个chunks
- Embedding成本：0.007元/文档

**100个文档**：
- 向量化总成本：约 ¥0.70
- 问答成本（10次对话）：约 ¥0.50
- **总计：约 ¥1.20**

---

## 🔧 故障排查

### 问题1：API Key无效

**错误信息**：`智谱AI Embedding失败: invalid api key`

**解决方法**：
1. 检查API Key是否正确复制
2. 确认API Key已启用
3. 检查账户是否有余额

### 问题2：向量化超时

**错误信息**：`向量化超时`

**解决方法**：
1. 检查网络连接
2. 文档太大？尝试减小文档大小
3. 增加超时时间（修改 `EMBEDDING_TIMEOUT`）

### 问题3：配额超限

**错误信息**：`API配额超限`

**解决方法**：
1. 检查账户余额
2. 查看API限流规则
3. 等待配额重置或充值

---

## 🔄 切换回OpenAI

如果后续想切换回OpenAI：

```bash
# .env.local
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
```

代码会自动切换，无需修改其他配置。

---

## 📞 获取帮助

- 智谱AI官方文档：https://open.bigmodel.cn/dev/api
- 智谱AI Discord社区：https://discord.gg/zhipuai
- 项目问题反馈：提交GitHub Issue

---

**祝测试顺利！🎉**

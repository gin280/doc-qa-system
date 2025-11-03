# 环境变量配置指南

## 快速配置模板

在项目根目录创建 `.env.local` 文件，复制以下内容并填写你的配置：

```bash
# ============================================
# 数据库配置 (必需)
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/database

# ============================================
# NextAuth配置 (必需)
# ============================================
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# ============================================
# Supabase存储配置 (必需)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================
# LLM配置 (选择一个)
# ============================================

# 方案1：智谱AI (推荐 - 国内友好)
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your-zhipu-api-key

# 方案2：OpenAI (备选)
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-your-openai-key

# ============================================
# 向量存储配置 (默认pgvector)
# ============================================
VECTOR_PROVIDER=pgvector

# ============================================
# Redis缓存配置 (可选，用于RAG查询缓存)
# Story 3.2新增
# ============================================
# 使用Upstash Redis (推荐)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# 注意：如果不配置Redis，系统仍可正常运行，但查询缓存功能将禁用

# ============================================
# OAuth配置 (可选)
# ============================================
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# GITHUB_CLIENT_ID=your-github-client-id
# GITHUB_CLIENT_SECRET=your-github-client-secret

# ============================================
# Ragas评估服务配置 (可选 - 仅用于RAG质量评估)
# Story 5.1新增
# ============================================
# RAGAS_API_URL=http://localhost:8000
# RAGAS_ENABLED=false
# RAGAS_TIMEOUT=30000
# RAGAS_CONCURRENCY=5
# RAGAS_VERBOSE=false

# Ragas使用的LLM配置 (使用智谱AI，推荐 - 国内网络稳定)
# ZHIPUAI_API_KEY=your-zhipuai-api-key

# 或使用OpenAI (备选 - 可能有网络问题)
# OPENAI_API_KEY=sk-your-openai-key
```

## 配置说明

### 1. 数据库配置

使用Supabase PostgreSQL数据库：

```bash
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 2. NextAuth配置

生成随机密钥：

```bash
# Mac/Linux
openssl rand -base64 32

# 或访问
https://generate-secret.vercel.app/32
```

### 3. LLM配置

#### 智谱AI（推荐）

1. 注册：https://open.bigmodel.cn/
2. 获取API Key：https://open.bigmodel.cn/usercenter/apikeys
3. 配置：

```bash
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=你的key
```

#### OpenAI（备选）

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
```

### 4. 测试配置

```bash
# 启动开发服务器
npm run dev

# 访问
http://localhost:3000
```

## 常见问题

### Q: 如何切换LLM提供商？

只需修改 `LLM_PROVIDER` 即可：

```bash
# 使用智谱AI
LLM_PROVIDER=zhipu

# 使用OpenAI  
LLM_PROVIDER=openai
```

### Q: 必需配置有哪些？

最小配置：
- DATABASE_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- Supabase配置（3个）
- LLM配置（智谱AI或OpenAI，选一个）

### Q: 如何验证配置是否正确？

运行验证脚本：

```bash
npm run verify:oauth
```

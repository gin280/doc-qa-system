# Ragas 评估环境部署指南

本指南帮助你在本地或生产环境中部署 Ragas 评估服务。

## 📋 目录

- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [Docker 部署](#docker-部署)
- [使用示例](#使用示例)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose
- 智谱AI API Key (推荐) 或 OpenAI API Key
- Node.js 18+

### 快速部署

```bash
# 1. 启动 Ragas 容器
docker-compose -f docker-compose.ragas.yml up -d

# 2. 验证服务状态
curl http://localhost:8000/health

# 3. 查看容器日志
docker-compose -f docker-compose.ragas.yml logs -f
```

## ⚙️ 环境配置

### 配置选项

在 `.env.local` 中添加以下配置：

```bash
# Ragas API URL (默认)
RAGAS_API_URL=http://localhost:8000

# 是否启用 Ragas 评估 (默认 false)
RAGAS_ENABLED=false

# 评估超时时间 (毫秒，默认 30000)
RAGAS_TIMEOUT=30000

# 批量评估并发数 (默认 5)
RAGAS_CONCURRENCY=5

# 是否开启详细日志 (默认 false)
RAGAS_VERBOSE=false
```

### LLM 配置方案

#### 方案 A：智谱AI（推荐 - 国内网络稳定）

```bash
# 使用智谱AI
ZHIPUAI_API_KEY=your-zhipuai-api-key

# Docker Compose 会自动配置：
# OPENAI_API_KEY=${ZHIPUAI_API_KEY}
# OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
# OPENAI_MODEL=glm-4
```

**优势**：
- ✅ 国内网络稳定，无需代理
- ✅ 成本更低（¥0.1/千tokens vs OpenAI $0.01/千tokens）
- ✅ API 格式兼容 OpenAI

#### 方案 B：OpenAI（备选）

```bash
# 使用 OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# 可选：设置代理
HTTP_PROXY=http://your-proxy:port
HTTPS_PROXY=http://your-proxy:port
```

**注意**：OpenAI 在国内可能需要稳定的网络代理。

## 🐳 Docker 部署

### 部署步骤

#### 1. 创建环境变量文件

创建 `.env` 文件（或在 `.env.local` 中配置）：

```bash
# 智谱AI（推荐）
ZHIPUAI_API_KEY=your-api-key
```

#### 2. 启动容器

```bash
# 启动服务
docker-compose -f docker-compose.ragas.yml up -d

# 查看日志
docker-compose -f docker-compose.ragas.yml logs -f ragas-api

# 检查容器状态
docker ps | grep docqa-ragas
```

#### 3. 验证部署

```bash
# 健康检查
curl http://localhost:8000/health

# 预期响应：
# {"status": "healthy"}
```

### Docker Compose 配置说明

```yaml
services:
  ragas-api:
    image: ragas/ragas-api:latest
    container_name: docqa-ragas
    ports:
      - "8000:8000"
    environment:
      # 自动使用智谱AI或OpenAI
      - OPENAI_API_KEY=${ZHIPUAI_API_KEY:-${OPENAI_API_KEY}}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://open.bigmodel.cn/api/paas/v4/}
      - OPENAI_MODEL=${OPENAI_MODEL:-glm-4}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - docqa-network
```

**配置说明**：
- 使用 `${ZHIPUAI_API_KEY:-${OPENAI_API_KEY}}` 优先使用智谱AI，回退到OpenAI
- 默认 `BASE_URL` 指向智谱AI
- 可通过环境变量覆盖任何配置

## 💻 使用示例

### 1. 在代码中使用

```typescript
import { RagasEvaluator } from '@/services/evaluation/ragasEvaluator';

// 创建评估器
const evaluator = new RagasEvaluator();

// 单次评估
const metrics = await evaluator.evaluateQA({
  question: "什么是RAG？",
  answer: "RAG是检索增强生成...",
  contexts: ["RAG结合了检索和生成..."],
  groundTruth: "RAG是一种结合检索的生成方法" // 可选
});

console.log('评估结果:', metrics);
// {
//   context_precision: 0.85,
//   context_recall: 0.78,
//   faithfulness: 0.92,
//   answer_relevancy: 0.88,
//   ragas_score: 0.86
// }
```

### 2. 批量评估

```typescript
import { RagasEvaluator } from '@/services/evaluation/ragasEvaluator';
import type { TestCase } from '@/types/evaluation';

const evaluator = new RagasEvaluator({
  concurrency: 5, // 并发数
  verbose: true,  // 详细日志
});

const testCases: TestCase[] = [
  {
    question: "问题1",
    answer: "答案1",
    contexts: ["上下文1"],
  },
  {
    question: "问题2",
    answer: "答案2",
    contexts: ["上下文2"],
  },
  // ... 更多测试用例
];

const report = await evaluator.evaluateDataset(testCases);

console.log('评估报告:', {
  总用例数: report.totalCases,
  平均分数: report.metrics.ragas_score,
  失败数: report.failedCases.length,
  耗时: `${report.duration}ms`,
});
```

### 3. 健康检查

```typescript
const evaluator = new RagasEvaluator();
const isHealthy = await evaluator.healthCheck();

if (!isHealthy) {
  console.error('Ragas 服务不可用');
}
```

## 🔧 故障排查

### 问题 1: 容器无法启动

**症状**：
```bash
docker-compose -f docker-compose.ragas.yml up -d
# Error: Cannot start container
```

**解决方案**：

1. 检查端口占用
```bash
lsof -i :8000
# 如果被占用，修改 docker-compose.ragas.yml 中的端口
```

2. 检查 Docker 资源
```bash
docker system df
docker system prune  # 清理未使用资源
```

3. 查看详细日志
```bash
docker-compose -f docker-compose.ragas.yml logs ragas-api
```

### 问题 2: API Key 未配置

**症状**：
```
Error: Missing API key
```

**解决方案**：

确认环境变量已设置：
```bash
# 检查环境变量
echo $ZHIPUAI_API_KEY
echo $OPENAI_API_KEY

# 如果未设置，添加到 .env.local
echo "ZHIPUAI_API_KEY=your-key" >> .env.local

# 重启容器
docker-compose -f docker-compose.ragas.yml restart
```

### 问题 3: 网络连接问题（OpenAI）

**症状**：
```
Error: Cannot connect to OpenAI API
```

**解决方案**：

1. **推荐：切换到智谱AI**
```bash
# 在 .env.local 中
ZHIPUAI_API_KEY=your-zhipuai-key

# 重启容器
docker-compose -f docker-compose.ragas.yml restart
```

2. **备选：配置代理（如果坚持使用OpenAI）**
```bash
# 在 docker-compose.ragas.yml 中添加
environment:
  - HTTP_PROXY=http://your-proxy:port
  - HTTPS_PROXY=http://your-proxy:port
```

### 问题 4: 评估超时

**症状**：
```
Error: Ragas API timeout after 30000ms
```

**解决方案**：

增加超时时间：
```typescript
const evaluator = new RagasEvaluator({
  timeout: 60000, // 60秒
});
```

或在环境变量中配置：
```bash
RAGAS_TIMEOUT=60000
```

### 问题 5: 内存不足

**症状**：
```
Container OOMKilled
```

**解决方案**：

在 `docker-compose.ragas.yml` 中增加内存限制：
```yaml
services:
  ragas-api:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

## 🚀 性能优化

### 1. 批量评估优化

```typescript
// 推荐配置
const evaluator = new RagasEvaluator({
  concurrency: 5,  // 根据API限流调整
  timeout: 30000,
});

// 大规模评估时分批处理
const batchSize = 50;
for (let i = 0; i < allTestCases.length; i += batchSize) {
  const batch = allTestCases.slice(i, i + batchSize);
  const report = await evaluator.evaluateDataset(batch);
  // 保存报告...
}
```

### 2. 成本控制

**评估成本估算**：
- 智谱AI: ~¥0.004/次评估 (glm-4)
- OpenAI: ~$0.01/次评估 (gpt-4o-mini)

**建议**：
- 开发时使用小规模测试集（10-20个用例）
- 正式评估使用完整测试集（50-100个用例）
- 生产监控使用10%采样

### 3. 缓存策略

对于相同的问题，可以缓存评估结果：

```typescript
const cache = new Map<string, RagasMetrics>();

async function evaluateWithCache(params: {
  question: string;
  answer: string;
  contexts: string[];
}) {
  const cacheKey = JSON.stringify(params);
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const metrics = await evaluator.evaluateQA(params);
  cache.set(cacheKey, metrics);
  
  return metrics;
}
```

## 📊 监控和日志

### 启用详细日志

```typescript
const evaluator = new RagasEvaluator({
  verbose: true,
});
```

或通过环境变量：
```bash
RAGAS_VERBOSE=true
```

### 查看容器日志

```bash
# 实时日志
docker-compose -f docker-compose.ragas.yml logs -f

# 最近100行
docker-compose -f docker-compose.ragas.yml logs --tail=100

# 特定容器
docker logs docqa-ragas
```

## 🔄 维护和更新

### 更新 Ragas 镜像

```bash
# 拉取最新镜像
docker pull ragas/ragas-api:latest

# 重启服务
docker-compose -f docker-compose.ragas.yml up -d --force-recreate
```

### 清理旧资源

```bash
# 停止容器
docker-compose -f docker-compose.ragas.yml down

# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune
```

## 📚 参考资源

- [Ragas 官方文档](https://docs.ragas.io/)
- [智谱AI API文档](https://open.bigmodel.cn/dev/api)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## 🆘 获取帮助

如遇到其他问题，请：
1. 检查容器日志
2. 验证环境变量配置
3. 确认网络连接
4. 查看 Ragas API 文档

## 下一步

完成 Ragas 环境搭建后，可以：
- Story 5.2: 建立RAG质量基准线
- Story 5.7: 验证改进效果
- Story 5.8: 集成生产监控


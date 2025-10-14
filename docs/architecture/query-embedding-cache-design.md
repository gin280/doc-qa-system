# Query Embedding 缓存架构设计

**架构师**: Winston  
**创建日期**: 2025-01-10  
**Story**: 4.2 - Query Embedding 缓存  
**状态**: Design Complete → Ready for Implementation

---

## 📋 设计目标

### 性能目标

| 指标 | 当前 | 目标 | 提升 |
|-----|------|------|------|
| 查询向量化时间 | 380ms | ~5ms (缓存命中) | 98.7% ⬇️ |
| 总检索时间 | 620ms | 245ms (缓存命中) | 60.5% ⬇️ |
| 缓存命中率 | 0% | >60% | - |

### 架构原则

1. **透明性**: 对调用方透明，无需修改 RetrievalService
2. **可靠性**: 缓存失败不影响主流程
3. **可观测性**: 完整的监控指标和日志
4. **可扩展性**: 支持未来多 LLM 提供商
5. **成本效益**: 使用现有 Upstash Redis 基础设施

---

## 🏗️ 架构概览

### 当前架构 (无缓存)

```
┌─────────────┐
│   用户查询   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  queryVectorizer.vectorize()│
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐  ~380ms
│   LLM API (Embedding)       │ ◄─────── 每次调用
│   (智谱AI embedding-2)      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│     向量检索 (pgvector)     │  ~240ms
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│      返回结果 (620ms)       │
└─────────────────────────────┘
```

### 目标架构 (Query Embedding 缓存)

```
┌─────────────┐
│   用户查询   │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  queryVectorizer.vectorize() - 增强版        │
└──────┬───────────────────────────────────────┘
       │
       ├─────► 1. 计算缓存键: qv:{hash(query)}
       │
       ▼
┌──────────────────────────────────────────────┐
│       Redis 缓存查询                         │
│       TTL: 1小时                             │
└──────┬───────────────────────────────────────┘
       │
       ├─ 命中 ──► ┌──────────────┐  ~5ms
       │           │ 返回缓存向量  │ ◄─────── 60%+ 命中率
       │           └──────┬───────┘
       │                  │
       ├─ 未命中 ─► ┌──────────────────────┐  ~380ms
       │            │  LLM API (Embedding) │ ◄─────── 40%- 未命中
       │            └──────┬───────────────┘
       │                   │
       │                   ├─ 存入缓存 (异步)
       │                   │
       ▼                   ▼
┌──────────────────────────────────────────────┐
│              向量检索 (pgvector)              │  ~240ms
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  返回结果                                    │
│  缓存命中: 245ms (60%+ 场景)                │
│  缓存未命中: 620ms (40%- 场景)              │
└──────────────────────────────────────────────┘
```

---

## 🔑 缓存键设计

### 命名空间策略

采用层次化命名空间，与现有 `rag:query:*` 区分：

```
qv:{provider}:{hash}
```

**示例**:
```
qv:zhipu:a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4
qv:openai:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9
```

### 键设计理由

1. **qv** (Query Vector): 明确标识为查询向量缓存
2. **{provider}**: LLM 提供商 (zhipu/openai/...)
   - 不同提供商的向量维度不同 (智谱1024 vs OpenAI1536)
   - 支持未来多 LLM 切换
3. **{hash}**: MD5(normalized_query)
   - 归一化: `query.trim().toLowerCase()`
   - 32字节 MD5: 节省 Redis 内存

### Hash 函数设计

```typescript
import { createHash } from 'crypto'

function generateEmbeddingCacheKey(
  query: string, 
  provider: string = 'zhipu'
): string {
  // 1. 归一化查询
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')  // 多空格归一
  
  // 2. 计算 MD5 hash
  const hash = createHash('md5')
    .update(normalized, 'utf8')
    .digest('hex')
  
  // 3. 生成缓存键
  return `qv:${provider}:${hash}`
}

// 示例
generateEmbeddingCacheKey('什么是AI?', 'zhipu')
// → 'qv:zhipu:a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4'

generateEmbeddingCacheKey('什么是AI？', 'zhipu')  // 中文标点
// → 'qv:zhipu:a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4'  // 相同 hash
```

---

## 💾 缓存策略设计

### TTL (Time-To-Live) 策略

**推荐 TTL: 1 小时 (3600秒)**

**理由**:
1. **相似问题频率**: 用户在短时间内重复或类似查询
2. **LLM 稳定性**: embedding-2 模型输出稳定，向量不会变化
3. **内存效率**: 1小时足够覆盖用户会话，避免无限增长
4. **平衡**: 足够长以提高命中率，足够短以释放冷数据

**TTL 对比分析**:

| TTL | 优点 | 缺点 | 推荐度 |
|-----|------|------|--------|
| 5分钟 | 快速释放内存 | 命中率低，收益有限 | ❌ |
| 30分钟 | 覆盖短会话 | 用户多次访问间隔可能超过 | ⚠️ |
| **1小时** | **平衡命中率和内存** | **适中** | ✅ 推荐 |
| 24小时 | 极高命中率 | 内存占用大，冷数据多 | ⚠️ |
| 永久 | 最高命中率 | 内存无限增长，需要主动清理 | ❌ |

### 驱逐策略

**Redis 配置**: `maxmemory-policy = allkeys-lru`

**理由**:
- LRU (Least Recently Used): 自动驱逐最少使用的键
- 与 TTL 配合，自动内存管理
- Upstash Redis 默认支持

### 缓存大小估算

**单个向量内存占用**:
```
Key: 'qv:zhipu:32字节hash' = ~50 bytes
Value: 1024维 float32 向量 = 1024 × 4 = 4096 bytes
Metadata: ~100 bytes (Redis 内部)
Total: ~4250 bytes ≈ 4.2 KB
```

**容量规划**:

| 缓存数量 | 内存占用 | 适用场景 |
|---------|---------|---------|
| 1,000 | ~4.2 MB | 小型应用 (100 DAU) |
| 10,000 | ~42 MB | 中型应用 (1000 DAU) |
| 100,000 | ~420 MB | 大型应用 (10000 DAU) |

**Upstash Free Tier**: 10,000 commands/day, 256MB storage  
**预期**: 10,000 缓存条目 (~42MB) 完全够用

---

## 🔄 缓存一致性策略

### 什么时候失效缓存?

#### 场景 1: LLM 提供商切换

**触发条件**: 切换 LLM_PROVIDER 环境变量

**策略**: 清除所有 `qv:{old_provider}:*` 键

```typescript
async function invalidateProviderCache(oldProvider: string): Promise<void> {
  const pattern = `qv:${oldProvider}:*`
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
    console.log(`[Cache] Invalidated ${keys.length} keys for provider ${oldProvider}`)
  }
}
```

#### 场景 2: Embedding 模型升级

**触发条件**: 模型版本变化 (如 embedding-2 → embedding-3)

**策略**: 
1. **方案 A (推荐)**: 修改 provider key (如 `zhipu-v2` → `zhipu-v3`)
2. **方案 B**: 清除所有缓存 (简单但影响命中率)

```typescript
// 方案 A: 版本化 provider
const PROVIDER_VERSION = 'zhipu-v2'  // 配置化

function generateCacheKey(query: string): string {
  return `qv:${PROVIDER_VERSION}:${hash(query)}`
}
```

#### 场景 3: 主动刷新 (不需要)

**结论**: Query Embedding 是**幂等操作**，相同查询永远返回相同向量，无需主动刷新。

---

## 📊 监控指标设计

### 关键指标

#### 1. 缓存命中率

```typescript
class EmbeddingCacheMetrics {
  private hits = 0
  private misses = 0
  
  get hitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : this.hits / total
  }
  
  recordHit(): void {
    this.hits++
  }
  
  recordMiss(): void {
    this.misses++
  }
  
  reset(): void {
    this.hits = 0
    this.misses = 0
  }
  
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
      total: this.hits + this.misses
    }
  }
}

// 导出全局指标
export const embeddingCacheMetrics = new EmbeddingCacheMetrics()
```

#### 2. 缓存性能指标

```typescript
interface CachePerformanceMetrics {
  // 延迟
  cacheLatency: number          // 缓存查询延迟 (ms)
  embeddingLatency: number      // API 调用延迟 (ms)
  
  // 吞吐
  cacheHits: number             // 累计命中次数
  cacheMisses: number           // 累计未命中次数
  
  // 存储
  cachedKeys: number            // 当前缓存键数量
  totalMemory: number           // 总内存占用 (bytes)
}
```

#### 3. Axiom 日志结构

```typescript
// 缓存命中日志
logger.info('embedding_cache_hit', {
  cacheKey: 'qv:zhipu:...',
  queryLength: 15,
  latency: 5,  // ms
  provider: 'zhipu'
})

// 缓存未命中日志
logger.info('embedding_cache_miss', {
  cacheKey: 'qv:zhipu:...',
  queryLength: 15,
  embeddingLatency: 380,  // ms
  provider: 'zhipu',
  cached: true  // 已写入缓存
})

// 缓存错误日志
logger.error('embedding_cache_error', {
  error: 'Redis connection failed',
  operation: 'get',
  fallback: 'LLM API'
})
```

### 监控 Dashboard (Axiom Query)

```sql
-- 缓存命中率 (过去1小时)
SELECT 
  COUNT(*) FILTER (WHERE event = 'embedding_cache_hit') AS hits,
  COUNT(*) FILTER (WHERE event = 'embedding_cache_miss') AS misses,
  (hits::float / (hits + misses)) * 100 AS hit_rate_percent
FROM logs
WHERE timestamp > now() - interval '1 hour'
  AND (event = 'embedding_cache_hit' OR event = 'embedding_cache_miss')

-- 平均延迟对比
SELECT
  AVG(latency) FILTER (WHERE event = 'embedding_cache_hit') AS cache_hit_latency,
  AVG(embeddingLatency) FILTER (WHERE event = 'embedding_cache_miss') AS api_latency
FROM logs
WHERE timestamp > now() - interval '1 hour'

-- 缓存节省的 API 调用次数
SELECT COUNT(*) AS api_calls_saved
FROM logs
WHERE timestamp > now() - interval '1 day'
  AND event = 'embedding_cache_hit'
```

---

## 🔧 实现设计

### 代码结构

```
src/
└── services/
    └── rag/
        ├── queryVectorizer.ts         # 现有 (需修改)
        ├── embeddingCache.ts          # 新增 ✨
        └── queryCacheService.ts       # 现有 (不变)
```

### embeddingCache.ts (新增服务)

```typescript
/**
 * Query Embedding 缓存服务
 * 缓存查询的向量表示，减少 LLM API 调用
 */

import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import { llmConfig } from '@/config/llm.config'

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  TTL: 3600,                    // 1小时 (秒)
  KEY_PREFIX: 'qv',             // Query Vector
  PROVIDER: llmConfig.provider  // 当前 LLM 提供商
} as const

/**
 * 缓存指标
 */
class EmbeddingCacheMetrics {
  private hits = 0
  private misses = 0

  recordHit(): void { this.hits++ }
  recordMiss(): void { this.misses++ }

  get hitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : (this.hits / total)
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
      total: this.hits + this.misses
    }
  }

  reset(): void {
    this.hits = 0
    this.misses = 0
  }
}

/**
 * Embedding 缓存服务类
 */
export class EmbeddingCacheService {
  private redis: Redis | null = null
  private metrics = new EmbeddingCacheMetrics()

  constructor() {
    // 仅在配置了 Redis 时初始化
    if (process.env.UPSTASH_REDIS_REST_URL && 
        process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN
        })
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[EmbeddingCache] Redis initialized successfully')
        }
      } catch (error) {
        console.warn('[EmbeddingCache] Failed to initialize Redis:', error)
      }
    } else {
      console.warn('[EmbeddingCache] Redis not configured, embedding caching disabled')
    }
  }

  /**
   * 生成缓存键
   * 格式: qv:{provider}:{hash}
   */
  private generateCacheKey(query: string): string {
    // 1. 归一化查询
    const normalized = query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')  // 多空格归一化
    
    // 2. 计算 MD5 hash
    const hash = createHash('md5')
      .update(normalized, 'utf8')
      .digest('hex')
    
    // 3. 生成缓存键
    return `${CACHE_CONFIG.KEY_PREFIX}:${CACHE_CONFIG.PROVIDER}:${hash}`
  }

  /**
   * 获取缓存的向量
   * @param query 查询问题
   * @returns 缓存的向量，不存在则返回 null
   */
  async get(query: string): Promise<number[] | null> {
    if (!this.redis) return null

    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query)

    try {
      const cached = await this.redis.get<number[]>(cacheKey)
      const latency = Date.now() - startTime

      if (cached) {
        // 缓存命中
        this.metrics.recordHit()
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[EmbeddingCache] Cache HIT:', {
            cacheKey,
            queryLength: query.length,
            vectorDim: cached.length,
            latency: `${latency}ms`,
            hitRate: `${(this.metrics.hitRate * 100).toFixed(1)}%`
          })
        }

        return cached
      }

      // 缓存未命中
      this.metrics.recordMiss()
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[EmbeddingCache] Cache MISS:', {
          cacheKey,
          queryLength: query.length,
          latency: `${latency}ms`,
          hitRate: `${(this.metrics.hitRate * 100).toFixed(1)}%`
        })
      }

      return null

    } catch (error) {
      console.warn('[EmbeddingCache] Failed to get cached embedding:', error)
      return null  // 缓存错误不影响主流程
    }
  }

  /**
   * 缓存向量
   * @param query 查询问题
   * @param vector 向量表示
   */
  async set(query: string, vector: number[]): Promise<void> {
    if (!this.redis) return

    const cacheKey = this.generateCacheKey(query)

    try {
      // 使用 SETEX 设置带 TTL 的缓存
      await this.redis.setex(
        cacheKey,
        CACHE_CONFIG.TTL,
        JSON.stringify(vector)
      )

      if (process.env.NODE_ENV === 'development') {
        console.log('[EmbeddingCache] Cached embedding:', {
          cacheKey,
          vectorDim: vector.length,
          ttl: CACHE_CONFIG.TTL
        })
      }

    } catch (error) {
      console.warn('[EmbeddingCache] Failed to cache embedding:', error)
      // 不抛出错误，缓存失败不影响主流程
    }
  }

  /**
   * 清除提供商的所有缓存
   * 用于 LLM 提供商切换或模型升级
   */
  async invalidateProvider(provider: string = CACHE_CONFIG.PROVIDER): Promise<void> {
    if (!this.redis) return

    try {
      const pattern = `${CACHE_CONFIG.KEY_PREFIX}:${provider}:*`
      const keys = await this.redis.keys(pattern)

      if (keys.length > 0) {
        await this.redis.del(...keys)
        console.log(`[EmbeddingCache] Invalidated ${keys.length} keys for provider ${provider}`)
      }

    } catch (error) {
      console.warn('[EmbeddingCache] Failed to invalidate provider cache:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    enabled: boolean
    metrics: ReturnType<EmbeddingCacheMetrics['getStats']>
    redisKeys?: number
    estimatedMemory?: string
  }> {
    if (!this.redis) {
      return {
        enabled: false,
        metrics: this.metrics.getStats()
      }
    }

    try {
      const pattern = `${CACHE_CONFIG.KEY_PREFIX}:${CACHE_CONFIG.PROVIDER}:*`
      const keys = await this.redis.keys(pattern)
      const keyCount = keys.length
      const estimatedMemory = `~${(keyCount * 4.2 / 1024).toFixed(2)} MB`

      return {
        enabled: true,
        metrics: this.metrics.getStats(),
        redisKeys: keyCount,
        estimatedMemory
      }

    } catch (error) {
      console.warn('[EmbeddingCache] Failed to get cache stats:', error)
      return {
        enabled: true,
        metrics: this.metrics.getStats()
      }
    }
  }

  /**
   * 检查缓存是否启用
   */
  isEnabled(): boolean {
    return this.redis !== null
  }

  /**
   * 重置缓存指标
   */
  resetMetrics(): void {
    this.metrics.reset()
  }
}

// 导出单例
export const embeddingCache = new EmbeddingCacheService()
```

### queryVectorizer.ts (修改)

```typescript
/**
 * 查询向量化服务
 * 将用户问题转换为向量用于检索
 * 
 * Story 4.2: 添加 Embedding 缓存支持 ✨
 */

import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { llmConfig, EMBEDDING_DIMENSION } from '@/config/llm.config'
import { embeddingCache } from './embeddingCache'  // ✨ 新增

export class QueryVectorizationError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'QueryVectorizationError'
  }
}

export class QueryVectorizer {
  private llmRepo = LLMRepositoryFactory.create(llmConfig)

  /**
   * 向量化查询问题 (带缓存)
   * @param question 用户问题(1-1000字符)
   * @returns 向量表示
   * @throws {QueryVectorizationError} 向量化失败或超时
   */
  async vectorizeQuery(question: string): Promise<number[]> {
    const startTime = Date.now()

    try {
      // 输入验证
      const trimmed = question.trim()
      if (!trimmed) {
        throw new QueryVectorizationError('Question cannot be empty', 'INVALID_INPUT')
      }
      
      if (trimmed.length > 1000) {
        throw new QueryVectorizationError('Question too long (max 1000 characters)', 'INVALID_INPUT')
      }

      // ✨ Story 4.2: 尝试从缓存获取
      const cachedVector = await embeddingCache.get(trimmed)
      
      if (cachedVector) {
        const elapsed = Date.now() - startTime
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[QueryVectorizer] Using cached embedding:', {
            questionLength: trimmed.length,
            vectorDim: cachedVector.length,
            elapsed: `${elapsed}ms`,
            source: 'cache'
          })
        }

        return cachedVector
      }

      // 缓存未命中，调用 LLM API
      const vectors = await this.llmRepo.generateEmbeddings([trimmed])
      
      if (!vectors || vectors.length === 0) {
        throw new QueryVectorizationError('Empty embedding response', 'EMBEDDING_ERROR')
      }

      const vector = vectors[0]
      
      // 验证向量维度
      if (vector.length !== EMBEDDING_DIMENSION) {
        throw new QueryVectorizationError(
          `Invalid vector dimension: ${vector.length}, expected ${EMBEDDING_DIMENSION}`,
          'EMBEDDING_ERROR'
        )
      }

      // ✨ Story 4.2: 异步写入缓存 (不阻塞响应)
      embeddingCache.set(trimmed, vector).catch(err => {
        console.warn('[QueryVectorizer] Failed to cache embedding:', err)
      })

      const elapsed = Date.now() - startTime

      if (process.env.NODE_ENV === 'development') {
        console.log('[QueryVectorizer] Query vectorized:', {
          questionLength: trimmed.length,
          vectorDim: vector.length,
          elapsed: `${elapsed}ms`,
          source: 'api',
          cached: true  // 已写入缓存
        })
      }

      return vector

    } catch (error) {
      const elapsed = Date.now() - startTime

      console.error('[QueryVectorizer] Query vectorization failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsed: `${elapsed}ms`
      })

      // 错误处理逻辑保持不变...
      if (error instanceof QueryVectorizationError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        throw new QueryVectorizationError('Embedding request timeout', 'EMBEDDING_TIMEOUT')
      } else if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        throw new QueryVectorizationError('API quota exceeded', 'QUOTA_EXCEEDED')
      } else {
        throw new QueryVectorizationError('Embedding generation failed', 'EMBEDDING_ERROR')
      }
    }
  }
}

// 导出单例
export const queryVectorizer = new QueryVectorizer()
```

### 监控 API 端点 (可选)

```typescript
// src/app/api/monitoring/embedding-cache/route.ts

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { embeddingCache } from '@/services/rag/embeddingCache'

/**
 * GET /api/monitoring/embedding-cache
 * 获取 Embedding 缓存统计信息
 * 
 * 仅管理员可访问
 */
export async function GET() {
  // 1. 认证检查
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: 添加管理员权限检查
  // if (session.user.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // }

  // 2. 获取缓存统计
  const stats = await embeddingCache.getStats()

  return NextResponse.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  })
}
```

---

## 📈 性能影响分析

### 预期性能提升

**假设**:
- 缓存命中率: 60% (保守估计)
- 缓存查询延迟: 5ms (Redis)
- API 调用延迟: 380ms (LLM Embedding)

**计算**:
```
加权平均延迟 = (命中率 × 缓存延迟) + (未命中率 × API延迟)
             = (0.6 × 5ms) + (0.4 × 380ms)
             = 3ms + 152ms
             = 155ms

性能提升 = (380ms - 155ms) / 380ms = 59.2%
```

**总检索时间**:
```
当前: 380ms (向量化) + 240ms (检索) = 620ms
优化: 155ms (向量化) + 240ms (检索) = 395ms

总提升 = (620ms - 395ms) / 620ms = 36.3%
```

### 成本节省

**LLM API 成本**:
- 智谱AI Embedding-2: ¥0.0005/1K tokens
- 平均查询: ~20 tokens
- 单次调用成本: ~¥0.00001

**缓存节省** (60% 命中率):
```
每日查询: 1000次
缓存命中: 600次
节省成本: 600 × ¥0.00001 = ¥0.006/天 = ¥2.19/年
```

**注意**: 成本节省不是主要收益，**用户体验提升**才是核心价值。

---

## 🧪 测试策略

### 单元测试

```typescript
// tests/unit/services/rag/embeddingCache.test.ts

describe('EmbeddingCacheService', () => {
  let cache: EmbeddingCacheService
  let mockRedis: jest.Mocked<Redis>

  beforeEach(() => {
    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn(),
      del: jest.fn()
    } as any

    cache = new EmbeddingCacheService()
    cache['redis'] = mockRedis
  })

  describe('get', () => {
    it('应该返回缓存的向量', async () => {
      const query = '什么是AI?'
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(vector)

      const result = await cache.get(query)

      expect(result).toEqual(vector)
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('qv:zhipu:')
      )
    })

    it('应该在缓存未命中时返回null', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await cache.get('新问题')

      expect(result).toBeNull()
    })

    it('应该归一化查询字符串', async () => {
      mockRedis.get.mockResolvedValue(null)

      await cache.get('什么是  AI ?')  // 多空格
      await cache.get('什么是 ai ?')   // 小写

      // 两次调用应该使用相同的缓存键
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).toBe(calls[1][0])
    })
  })

  describe('set', () => {
    it('应该缓存向量并设置TTL', async () => {
      const query = '什么是AI?'
      const vector = new Array(1024).fill(0.1)

      await cache.set(query, vector)

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('qv:zhipu:'),
        3600,  // TTL
        JSON.stringify(vector)
      )
    })

    it('应该在Redis失败时不抛出错误', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'))

      await expect(
        cache.set('问题', [1, 2, 3])
      ).resolves.not.toThrow()
    })
  })

  describe('getStats', () => {
    it('应该返回缓存统计信息', async () => {
      // 模拟一些缓存命中
      mockRedis.get.mockResolvedValueOnce([1, 2, 3])
      await cache.get('query1')
      
      mockRedis.get.mockResolvedValueOnce(null)
      await cache.get('query2')

      mockRedis.keys.mockResolvedValue(['key1', 'key2'])

      const stats = await cache.getStats()

      expect(stats).toMatchObject({
        enabled: true,
        metrics: {
          hits: 1,
          misses: 1,
          hitRate: 0.5,
          total: 2
        },
        redisKeys: 2
      })
    })
  })
})
```

### 集成测试

```typescript
// tests/integration/rag/embedding-cache.test.ts

describe('Embedding Cache Integration', () => {
  it('应该完整测试缓存流程', async () => {
    const query = '什么是人工智能?'

    // 第一次调用 - 缓存未命中
    const start1 = Date.now()
    const vector1 = await queryVectorizer.vectorizeQuery(query)
    const time1 = Date.now() - start1

    expect(vector1).toHaveLength(1024)
    expect(time1).toBeGreaterThan(300)  // 应该调用API

    // 第二次调用 - 缓存命中
    const start2 = Date.now()
    const vector2 = await queryVectorizer.vectorizeQuery(query)
    const time2 = Date.now() - start2

    expect(vector2).toEqual(vector1)  // 向量相同
    expect(time2).toBeLessThan(50)    // 应该从缓存返回
  })

  it('应该处理归一化查询', async () => {
    const queries = [
      '什么是AI?',
      '什么是AI？',  // 中文标点
      '什么是  AI ?',  // 多空格
      '什么是 ai ?'    // 小写
    ]

    // 第一次调用
    await queryVectorizer.vectorizeQuery(queries[0])

    // 后续调用应该都命中缓存
    for (const query of queries.slice(1)) {
      const start = Date.now()
      await queryVectorizer.vectorizeQuery(query)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(50)  // 应该从缓存返回
    }
  })
})
```

### 性能测试

```typescript
// tests/performance/embedding-cache.perf.ts

describe('Embedding Cache Performance', () => {
  it('应该达到目标命中率 (>60%)', async () => {
    // 模拟真实用户查询分布
    const queries = [
      '什么是AI?',
      '什么是AI？',  // 重复
      '人工智能的定义',
      '什么是AI?',   // 重复
      'AI的应用',
      '什么是AI?',   // 重复
      'AI vs ML',
      '人工智能的定义',  // 重复
    ]

    let cacheHits = 0
    let cacheMisses = 0

    for (const query of queries) {
      const start = Date.now()
      await queryVectorizer.vectorizeQuery(query)
      const elapsed = Date.now() - start

      if (elapsed < 50) {
        cacheHits++
      } else {
        cacheMisses++
      }
    }

    const hitRate = cacheHits / queries.length

    console.log(`Cache Hit Rate: ${(hitRate * 100).toFixed(1)}%`)
    console.log(`Hits: ${cacheHits}, Misses: ${cacheMisses}`)

    expect(hitRate).toBeGreaterThan(0.6)  // >60% 命中率
  })

  it('应该测试缓存性能提升', async () => {
    const query = '测试查询'
    
    // 预热缓存
    await queryVectorizer.vectorizeQuery(query)

    // 性能测试
    const iterations = 100
    const start = Date.now()

    for (let i = 0; i < iterations; i++) {
      await queryVectorizer.vectorizeQuery(query)
    }

    const elapsed = Date.now() - start
    const avgLatency = elapsed / iterations

    console.log(`Average latency (cached): ${avgLatency.toFixed(2)}ms`)

    expect(avgLatency).toBeLessThan(10)  // 应该 <10ms
  })
})
```

---

## 🚀 部署和配置

### 环境变量

**.env.local** (已存在，无需修改):
```bash
# Redis 配置 (已配置)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# LLM 配置 (已配置)
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=your-zhipu-api-key
```

### Upstash Redis 配置

**当前配置**: 已配置 (Story 3.2)

**验证**:
```bash
curl https://your-redis.upstash.io/ping \
  -H "Authorization: Bearer your-redis-token"

# 预期输出: {"result":"PONG"}
```

### 监控配置

**Axiom Dataset**: `doc-qa-system`  
**监控指标**:
- `embedding_cache_hit`
- `embedding_cache_miss`
- `embedding_cache_error`

**告警规则** (建议):
1. 缓存命中率 < 40% (24小时窗口)
2. 缓存错误率 > 5%
3. Redis 内存使用 > 200MB

---

## 📚 文档和知识传递

### 开发者文档

```markdown
# Query Embedding 缓存使用指南

## 概述

Query Embedding 缓存自动缓存查询向量，无需修改调用代码。

## 工作原理

1. **透明缓存**: `queryVectorizer.vectorizeQuery()` 自动使用缓存
2. **自动失效**: TTL 1小时，Redis LRU 自动管理内存
3. **降级友好**: 缓存失败自动回退到 API 调用

## 监控

### 查看缓存统计

```typescript
import { embeddingCache } from '@/services/rag/embeddingCache'

const stats = await embeddingCache.getStats()
console.log(stats)
// {
//   enabled: true,
//   metrics: {
//     hits: 150,
//     misses: 100,
//     hitRate: 0.6,
//     total: 250
//   },
//   redisKeys: 180,
//   estimatedMemory: '~0.76 MB'
// }
```

### Axiom 查询

```sql
-- 缓存命中率
SELECT 
  (COUNT(*) FILTER (WHERE event = 'embedding_cache_hit')::float / 
   COUNT(*))::numeric(4,2) AS hit_rate
FROM logs
WHERE timestamp > now() - interval '1 hour'
```

## 故障排查

### 缓存未启用

**症状**: 所有查询都调用 API  
**检查**: 
```bash
# 检查环境变量
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

### 命中率低

**症状**: 命中率 < 40%  
**可能原因**:
1. 用户查询非常多样化 (正常)
2. TTL 过短 (检查配置)
3. Redis 内存不足 (检查 Upstash 配额)

### Redis 错误

**症状**: 日志中出现 Redis 连接错误  
**影响**: 无，自动降级到 API
**解决**: 检查 Upstash 服务状态和配额
```

---

## ✅ 验收标准

### 功能验收

- [ ] 缓存键生成正确 (归一化 + MD5)
- [ ] 缓存命中时返回缓存向量
- [ ] 缓存未命中时调用 API 并缓存
- [ ] TTL 1小时生效
- [ ] 缓存失败不影响主流程

### 性能验收

- [ ] 缓存命中延迟 < 10ms
- [ ] 缓存命中率 > 60% (真实流量)
- [ ] 总检索时间平均提升 > 50%
- [ ] P95 检索时间 < 400ms

### 质量验收

- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试通过
- [ ] 性能测试验证达标
- [ ] 文档完整

### 监控验收

- [ ] 缓存命中率 Dashboard 可用
- [ ] 缓存错误告警配置
- [ ] Axiom 日志正常上报

---

## 🔄 未来优化方向

### Phase 2: 智能预热

```typescript
/**
 * 热门查询自动预热
 * 定期分析 Axiom 日志，预热高频查询
 */
async function preheatPopularQueries() {
  // 从 Axiom 获取 Top 100 查询
  const popularQueries = await fetchPopularQueries(100)
  
  // 并发预热
  await Promise.all(
    popularQueries.map(q => queryVectorizer.vectorizeQuery(q))
  )
}
```

### Phase 3: 多级缓存

```
┌─────────────┐
│  L1: Memory │  10ms TTL, 100 条
├─────────────┤
│  L2: Redis  │  1h TTL, 10000 条
└─────────────┘
```

### Phase 4: 语义缓存

```typescript
/**
 * 语义相似查询共享缓存
 * "什么是AI?" 和 "AI是什么?" 应该共享缓存
 */
async function semanticCacheKey(query: string): Promise<string> {
  // 1. 语义向量化
  const semanticVector = await semanticEncoder.encode(query)
  
  // 2. 查找最相似的已缓存查询 (cosine > 0.95)
  const similarCached = await findSimilarCachedQuery(semanticVector, 0.95)
  
  if (similarCached) {
    return similarCached.cacheKey  // 复用缓存
  }
  
  return generateNewCacheKey(query)
}
```

---

## 📞 联系和支持

**架构师**: Winston  
**文档**: `docs/architecture/query-embedding-cache-design.md`  
**代码**: `src/services/rag/embeddingCache.ts`  
**测试**: `tests/unit/services/rag/embeddingCache.test.ts`

**问题反馈**: 
- Slack: `#epic-4-quality`
- GitHub Issue: Tag `@Winston` + `performance`

---

**架构设计状态**: ✅ **Complete**  
**实施就绪**: ✅ **Ready**  
**创建日期**: 2025-01-10  
**审核人**: 待 Dev + QA 审核




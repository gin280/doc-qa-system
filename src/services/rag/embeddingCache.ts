/**
 * Query Embedding 缓存服务
 * Story 4.2: 缓存查询向量以减少LLM API调用,提升检索性能
 * 
 * 性能目标:
 * - 缓存命中延迟: < 10ms
 * - 缓存命中率: > 60%
 * - 总检索时间优化: 从 ~600ms 到 ~220ms (63% 提升)
 */

import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'

/**
 * 缓存配置常量
 */
const CACHE_CONFIG = {
  TTL: 3600,                    // 1小时 (秒)
  KEY_PREFIX: 'qv',             // Query Vector 命名空间
  PROVIDER: 'zhipu'             // 当前LLM提供商
} as const

/**
 * 缓存指标收集器
 */
class EmbeddingCacheMetrics {
  private hits = 0
  private misses = 0

  recordHit(): void { 
    this.hits++ 
  }
  
  recordMiss(): void { 
    this.misses++ 
  }

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
 * 
 * 功能:
 * 1. 缓存查询的向量表示
 * 2. 降级友好: 缓存失败不影响主流程
 * 3. 监控: 收集命中率等指标
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
          logger.info({ service: 'EmbeddingCache' }, 'Redis initialized successfully')
        }
      } catch (error) {
        logger.warn({ service: 'EmbeddingCache', error }, 'Failed to initialize Redis')
      }
    } else {
      logger.warn({ service: 'EmbeddingCache' }, 'Redis not configured, embedding caching disabled')
    }
  }

  /**
   * 验证缓存向量的完整性
   * Story 4.2 QA修复: 防止损坏的缓存数据导致检索错误
   * 
   * 验证规则:
   * 1. 类型必须是数组
   * 2. 维度必须是 1024
   * 3. 所有值必须是有效数字 (非 NaN, 非 Infinity)
   * 
   * @param vector 待验证的向量
   * @returns true: 有效, false: 无效
   */
  private validateVector(vector: unknown): vector is number[] {
    // 1. 验证类型
    if (!Array.isArray(vector)) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        vectorType: typeof vector,
        action: 'validation_error'
      }, 'Invalid cached vector: not an array')
      return false
    }
    
    // 2. 验证维度 (智谱 Embedding-2 模型: 1024维)
    if (vector.length !== 1024) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        dimension: vector.length,
        expected: 1024,
        action: 'validation_error'
      }, 'Invalid cached vector: wrong dimension')
      return false
    }
    
    // 3. 验证数值有效性
    const hasInvalidValue = vector.some(v => 
      typeof v !== 'number' || !isFinite(v)
    )
    
    if (hasInvalidValue) {
      logger.warn({ 
        service: 'EmbeddingCache',
        action: 'validation_error'
      }, 'Invalid cached vector: contains NaN or Infinity')
      return false
    }
    
    return true
  }

  /**
   * 生成缓存键
   * 格式: qv:{provider}:{hash}
   * 
   * 归一化策略:
   * - trim(): 移除首尾空格
   * - toLowerCase(): 统一小写
   * - replace(/\s+/g, ' '): 多空格归一
   */
  private generateCacheKey(query: string): string {
    // 1. 归一化查询
    const normalized = query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    
    // 2. 计算 MD5 hash (32字节,节省内存)
    const hash = createHash('md5')
      .update(normalized, 'utf8')
      .digest('hex')
    
    // 3. 生成缓存键: qv:zhipu:a3f8b9c2...
    return `${CACHE_CONFIG.KEY_PREFIX}:${CACHE_CONFIG.PROVIDER}:${hash}`
  }

  /**
   * 获取缓存的向量
   * 
   * @param query 查询问题
   * @returns 缓存的向量,不存在或失败返回 null
   */
  async get(query: string): Promise<number[] | null> {
    if (!this.redis) return null

    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query)

    try {
      const cached = await this.redis.get<string>(cacheKey)
      const latency = Date.now() - startTime

      if (cached) {
        // 解析缓存数据
        const vector = JSON.parse(cached) as number[]
        
        // ✨ QA修复: 验证缓存数据完整性
        if (!this.validateVector(vector)) {
          logger.warn({ 
            service: 'EmbeddingCache', 
            cacheKey,
            action: 'cache_corrupted'
          }, 'Corrupted cache detected, removing')
          // 删除损坏的缓存数据
          try {
            await this.redis.del(cacheKey)
          } catch (delError) {
            // 删除失败不影响主流程
          }
          // 视为缓存未命中,让调用方重新生成
          this.metrics.recordMiss()
          return null
        }
        
        // 缓存命中且数据有效
        this.metrics.recordHit()
        
        if (process.env.NODE_ENV === 'development') {
          logger.info({
            service: 'EmbeddingCache',
            cacheKey,
            queryLength: query.length,
            vectorDim: vector.length,
            latency,
            hitRate: this.metrics.hitRate,
            action: 'cache_hit'
          }, 'Cache HIT')
        }

        return vector
      }

      // 缓存未命中
      this.metrics.recordMiss()
      
      if (process.env.NODE_ENV === 'development') {
        logger.info({
          service: 'EmbeddingCache',
          cacheKey,
          queryLength: query.length,
          latency,
          hitRate: this.metrics.hitRate,
          action: 'cache_miss'
        }, 'Cache MISS')
      }

      return null

    } catch (error) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        error,
        action: 'cache_error'
      }, 'Failed to get cached embedding')
      return null  // 缓存错误不影响主流程,自动降级
    }
  }

  /**
   * 缓存向量 (异步执行,不阻塞主流程)
   * 
   * @param query 查询问题
   * @param vector 向量表示 (1024维)
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
        logger.info({
          service: 'EmbeddingCache',
          cacheKey,
          vectorDim: vector.length,
          ttl: CACHE_CONFIG.TTL,
          action: 'cache_set'
        }, 'Cached embedding')
      }

    } catch (error) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        error,
        action: 'cache_set_error'
      }, 'Failed to cache embedding')
      // 不抛出错误,缓存失败不影响主流程
    }
  }

  /**
   * 清除提供商的所有缓存
   * 用于 LLM 提供商切换或模型升级
   * 
   * @param provider 提供商名称 (默认当前提供商)
   */
  async invalidateProvider(provider: string = CACHE_CONFIG.PROVIDER): Promise<void> {
    if (!this.redis) return

    try {
      const pattern = `${CACHE_CONFIG.KEY_PREFIX}:${provider}:*`
      const keys = await this.redis.keys(pattern)

      if (keys.length > 0) {
        await this.redis.del(...keys)
        logger.info({
          service: 'EmbeddingCache',
          provider,
          keysInvalidated: keys.length,
          action: 'cache_invalidate'
        }, `Invalidated ${keys.length} keys for provider ${provider}`)
      }

    } catch (error) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        provider,
        error,
        action: 'cache_invalidate_error'
      }, 'Failed to invalidate provider cache')
    }
  }

  /**
   * 获取缓存统计信息
   * 
   * @returns 缓存状态、指标、Redis键数量、内存估算
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
      // 单个向量 ~4.2KB: 50 bytes (key) + 4096 bytes (1024维×4字节)
      const estimatedMemory = `~${(keyCount * 4.2 / 1024).toFixed(2)} MB`

      return {
        enabled: true,
        metrics: this.metrics.getStats(),
        redisKeys: keyCount,
        estimatedMemory
      }

    } catch (error) {
      logger.warn({ 
        service: 'EmbeddingCache', 
        error,
        action: 'stats_error'
      }, 'Failed to get cache stats')
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
   * 重置缓存指标 (用于测试)
   */
  resetMetrics(): void {
    this.metrics.reset()
  }
}

// 导出单例
export const embeddingCache = new EmbeddingCacheService()


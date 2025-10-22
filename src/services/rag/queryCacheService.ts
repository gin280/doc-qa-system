/**
 * RAG查询缓存服务
 * 使用Redis缓存检索结果，减少重复API调用
 */

import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import type { RetrievalResult } from '@/types/rag'
import { logger, logCache } from '@/lib/logger'

/**
 * 查询缓存服务类
 */
export class QueryCacheService {
  private redis: Redis | null = null
  private readonly CACHE_TTL = 30 * 60 // 30分钟（秒）

  constructor() {
    // 仅在配置了Redis时初始化
    if (process.env.UPSTASH_REDIS_REST_URL && 
        process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN
        })
        logger.info({
          action: 'cache_redis_init_success'
        }, 'Redis initialized successfully')
      } catch (error) {
        logger.warn({
          error: error instanceof Error ? error.message : String(error),
          action: 'cache_redis_init_error'
        }, 'Failed to initialize Redis')
      }
    } else {
      logger.warn({
        action: 'cache_redis_not_configured'
      }, 'Redis not configured, query caching disabled')
    }
  }

  /**
   * 生成缓存键
   * 格式: rag:query:{documentId}:{queryHash}
   */
  private getCacheKey(documentId: string, query: string): string {
    const queryHash = createHash('md5')
      .update(query.toLowerCase().trim())
      .digest('hex')
    return `rag:query:${documentId}:${queryHash}`
  }

  /**
   * 获取缓存的检索结果
   * @param documentId 文档ID
   * @param query 查询问题
   * @returns 缓存的检索结果，不存在则返回null
   */
  async getCachedResult(
    documentId: string, 
    query: string
  ): Promise<RetrievalResult | null> {
    if (!this.redis) return null

    try {
      const key = this.getCacheKey(documentId, query)
      const cached = await this.redis.get<RetrievalResult>(key)
      
      if (cached) {
        // 标记为来自缓存
        return { ...cached, cached: true }
      }
      
      return null
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        documentId,
        action: 'cache_get_error'
      }, 'Failed to get cached result')
      return null
    }
  }

  /**
   * 缓存检索结果
   * @param documentId 文档ID
   * @param query 查询问题
   * @param result 检索结果
   */
  async setCachedResult(
    documentId: string, 
    query: string, 
    result: RetrievalResult
  ): Promise<void> {
    if (!this.redis) return

    try {
      const key = this.getCacheKey(documentId, query)
      
      // 使用setex设置带TTL的缓存
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(result))
      
      logCache({
        cacheKey: key,
        hit: false,
        missTime: this.CACHE_TTL
      })
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        documentId,
        action: 'cache_set_error'
      }, 'Failed to cache result')
      // 不抛出错误，缓存失败不影响主流程
    }
  }

  /**
   * 清除文档相关的所有查询缓存
   * 用于文档更新或删除时
   * @param documentId 文档ID
   */
  async invalidateDocumentCache(documentId: string): Promise<void> {
    if (!this.redis) return

    try {
      const pattern = `rag:query:${documentId}:*`
      
      // 使用SCAN命令查找所有匹配的键
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        // 批量删除
        await this.redis.del(...keys)
        
        logger.info({
          documentId,
          keysDeleted: keys.length,
          action: 'cache_invalidate_success'
        }, 'Invalidated document query cache')
      }
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        documentId,
        action: 'cache_invalidate_error'
      }, 'Failed to invalidate document cache')
    }
  }

  /**
   * 检查Redis连接状态
   */
  isEnabled(): boolean {
    return this.redis !== null
  }

  /**
   * 获取缓存统计信息（用于监控）
   */
  async getCacheStats(documentId?: string): Promise<{
    enabled: boolean
    totalKeys?: number
    documentKeys?: number
  }> {
    if (!this.redis) {
      return { enabled: false }
    }

    try {
      const pattern = documentId ? `rag:query:${documentId}:*` : 'rag:query:*'
      const keys = await this.redis.keys(pattern)
      
      return {
        enabled: true,
        totalKeys: keys.length,
        documentKeys: documentId ? keys.length : undefined
      }
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        documentId,
        action: 'cache_stats_error'
      }, 'Failed to get cache stats')
      return { enabled: true }
    }
  }
}

// 导出单例
export const queryCacheService = new QueryCacheService()

/**
 * Embedding Cache 服务单元测试
 * Story 4.2
 * 
 * 覆盖率目标: >= 90%
 */

import { EmbeddingCacheService } from '@/services/rag/embeddingCache'
import type { Redis } from '@upstash/redis'

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  keys: jest.fn(),
  del: jest.fn()
} as unknown as jest.Mocked<Redis>

describe('EmbeddingCacheService', () => {
  let cache: EmbeddingCacheService

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks()
    
    // 确保 del 返回 Promise
    mockRedis.del.mockResolvedValue(1)
    
    // 创建新实例并注入 mock Redis
    cache = new EmbeddingCacheService()
    // @ts-ignore - 访问私有属性用于测试
    cache['redis'] = mockRedis
  })

  describe('generateCacheKey', () => {
    it('应该对相同查询生成相同的缓存键', async () => {
      const query1 = '什么是AI?'
      const query2 = '什么是AI?'
      
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get(query1)
      await cache.get(query2)
      
      // 验证使用了相同的缓存键
      expect(mockRedis.get).toHaveBeenCalledTimes(2)
      expect(mockRedis.get.mock.calls[0][0]).toBe(mockRedis.get.mock.calls[1][0])
    })

    it('应该归一化查询字符串 - 多空格', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('什么是  AI ?')  // 多空格
      await cache.get('什么是 ai ?')   // 小写 + 单空格
      
      // 两次调用应该使用相同的缓存键
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).toBe(calls[1][0])
    })

    it('应该归一化查询字符串 - 大小写', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('What is AI?')
      await cache.get('what is ai?')
      
      // 大小写不同但应该生成相同的键
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).toBe(calls[1][0])
    })

    it('应该归一化查询字符串 - 首尾空格', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('  什么是AI?  ')
      await cache.get('什么是ai?')
      
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).toBe(calls[1][0])
    })

    it('应该对不同查询生成不同的缓存键', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('什么是AI?')
      await cache.get('什么是机器学习?')
      
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).not.toBe(calls[1][0])
    })

    it('应该生成正确格式的缓存键', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('测试查询')
      
      const cacheKey = mockRedis.get.mock.calls[0][0] as string
      expect(cacheKey).toMatch(/^qv:zhipu:[a-f0-9]{32}$/)
    })
  })

  describe('get', () => {
    it('应该在缓存命中时返回向量', async () => {
      const query = '什么是AI?'
      const vector = new Array(1024).fill(0.1)
      
      mockRedis.get.mockResolvedValue(JSON.stringify(vector))
      
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

    it('应该正确解析JSON格式的向量', async () => {
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(vector))
      
      const result = await cache.get('测试')
      
      expect(result).toEqual(vector)
    })

    it('应该在Redis不可用时返回null', async () => {
      // 创建没有Redis的缓存实例
      const cacheWithoutRedis = new EmbeddingCacheService()
      // @ts-ignore
      cacheWithoutRedis['redis'] = null
      
      const result = await cacheWithoutRedis.get('测试')
      
      expect(result).toBeNull()
    })

    it('应该在Redis错误时返回null而不抛出异常', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))
      
      const result = await cache.get('测试')
      
      expect(result).toBeNull()
      // 不应该抛出错误
    })

    it('应该在JSON解析失败时返回null', async () => {
      mockRedis.get.mockResolvedValue('invalid json')
      
      const result = await cache.get('测试')
      
      expect(result).toBeNull()
    })

    it('应该记录缓存命中指标', async () => {
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(vector))
      
      await cache.get('query1')
      await cache.get('query2')
      
      const stats = await cache.getStats()
      expect(stats.metrics.hits).toBe(2)
      expect(stats.metrics.misses).toBe(0)
    })

    it('应该记录缓存未命中指标', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get('query1')
      await cache.get('query2')
      
      const stats = await cache.getStats()
      expect(stats.metrics.hits).toBe(0)
      expect(stats.metrics.misses).toBe(2)
    })
  })

  describe('validateVector - 数据完整性验证 (QA修复)', () => {
    it('应该拒绝非数组类型的缓存数据', async () => {
      // 模拟损坏的缓存数据 (字符串而非数组)
      mockRedis.get.mockResolvedValue(JSON.stringify("invalid string data"))
      
      const result = await cache.get('测试查询')
      
      // 应该返回 null (视为缓存未命中)
      expect(result).toBeNull()
      
      // 应该删除损坏的缓存
      expect(mockRedis.del).toHaveBeenCalled()
      
      // 应该记录为未命中
      const stats = await cache.getStats()
      expect(stats.metrics.misses).toBe(1)
      expect(stats.metrics.hits).toBe(0)
    })

    it('应该拒绝错误维度的向量', async () => {
      // 512维向量 (应该是1024维)
      const wrongDimVector = new Array(512).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(wrongDimVector))
      
      const result = await cache.get('测试查询')
      
      // 应该返回 null
      expect(result).toBeNull()
      
      // 应该删除损坏的缓存
      expect(mockRedis.del).toHaveBeenCalled()
      
      // 应该记录为未命中
      const stats = await cache.getStats()
      expect(stats.metrics.misses).toBe(1)
    })

    it('应该拒绝包含NaN或Infinity的向量', async () => {
      // 创建包含无效数值的向量
      const invalidVector = new Array(1024).fill(0.1)
      invalidVector[500] = NaN
      invalidVector[600] = Infinity
      invalidVector[700] = -Infinity
      
      mockRedis.get.mockResolvedValue(JSON.stringify(invalidVector))
      
      const result = await cache.get('测试查询')
      
      // 应该返回 null
      expect(result).toBeNull()
      
      // 应该删除损坏的缓存
      expect(mockRedis.del).toHaveBeenCalled()
      
      // 应该记录为未命中
      const stats = await cache.getStats()
      expect(stats.metrics.misses).toBe(1)
    })

    it('应该接受有效的1024维向量', async () => {
      // 正常的1024维向量
      const validVector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(validVector))
      
      const result = await cache.get('测试查询')
      
      // 应该返回向量
      expect(result).toEqual(validVector)
      
      // 不应该删除缓存
      expect(mockRedis.del).not.toHaveBeenCalled()
      
      // 应该记录为命中
      const stats = await cache.getStats()
      expect(stats.metrics.hits).toBe(1)
    })

    it('应该在del失败时仍然返回null', async () => {
      // 模拟损坏的缓存
      mockRedis.get.mockResolvedValue(JSON.stringify("invalid"))
      // 模拟del失败
      mockRedis.del.mockRejectedValue(new Error('Redis del failed'))
      
      const result = await cache.get('测试查询')
      
      // 仍然应该返回 null,不抛出错误
      expect(result).toBeNull()
      
      // 应该尝试删除
      expect(mockRedis.del).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('应该缓存向量并设置TTL', async () => {
      const query = '什么是AI?'
      const vector = new Array(1024).fill(0.1)
      
      await cache.set(query, vector)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('qv:zhipu:'),
        3600,  // TTL = 1小时
        JSON.stringify(vector)
      )
    })

    it('应该正确序列化向量为JSON', async () => {
      const vector = [0.1, 0.2, 0.3, 0.4]
      
      await cache.set('测试', vector)
      
      const call = mockRedis.setex.mock.calls[0]
      const storedValue = call[2] as string
      expect(JSON.parse(storedValue)).toEqual(vector)
    })

    it('应该在Redis不可用时静默失败', async () => {
      const cacheWithoutRedis = new EmbeddingCacheService()
      // @ts-ignore
      cacheWithoutRedis['redis'] = null
      
      // 不应该抛出错误
      await expect(
        cacheWithoutRedis.set('测试', [1, 2, 3])
      ).resolves.not.toThrow()
    })

    it('应该在Redis失败时不抛出错误', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'))
      
      await expect(
        cache.set('问题', [1, 2, 3])
      ).resolves.not.toThrow()
    })

    it('应该处理大向量(1024维)', async () => {
      const largeVector = new Array(1024).fill(0.123456)
      
      await cache.set('大向量测试', largeVector)
      
      expect(mockRedis.setex).toHaveBeenCalled()
      const storedValue = mockRedis.setex.mock.calls[0][2] as string
      expect(JSON.parse(storedValue)).toHaveLength(1024)
    })
  })

  describe('invalidateProvider', () => {
    it('应该删除指定提供商的所有缓存键', async () => {
      const keys = ['qv:zhipu:key1', 'qv:zhipu:key2', 'qv:zhipu:key3']
      mockRedis.keys.mockResolvedValue(keys)
      
      await cache.invalidateProvider('zhipu')
      
      expect(mockRedis.keys).toHaveBeenCalledWith('qv:zhipu:*')
      expect(mockRedis.del).toHaveBeenCalledWith(...keys)
    })

    it('应该在没有缓存键时不调用del', async () => {
      mockRedis.keys.mockResolvedValue([])
      
      await cache.invalidateProvider('zhipu')
      
      expect(mockRedis.keys).toHaveBeenCalled()
      expect(mockRedis.del).not.toHaveBeenCalled()
    })

    it('应该在Redis失败时不抛出错误', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'))
      
      await expect(
        cache.invalidateProvider('zhipu')
      ).resolves.not.toThrow()
    })

    it('应该使用默认提供商', async () => {
      mockRedis.keys.mockResolvedValue([])
      
      await cache.invalidateProvider()
      
      expect(mockRedis.keys).toHaveBeenCalledWith('qv:zhipu:*')
    })
  })

  describe('getStats', () => {
    it('应该返回完整的统计信息', async () => {
      // 模拟一些缓存操作
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(vector))
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
        redisKeys: 2,
        estimatedMemory: expect.stringContaining('MB')
      })
    })

    it('应该计算正确的命中率', async () => {
      // 3次命中, 1次未命中
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(vector))
      await cache.get('q1')
      await cache.get('q2')
      await cache.get('q3')
      
      mockRedis.get.mockResolvedValue(null)
      await cache.get('q4')
      
      mockRedis.keys.mockResolvedValue([])
      
      const stats = await cache.getStats()
      
      expect(stats.metrics.hitRate).toBeCloseTo(0.75) // 75%
    })

    it('应该在Redis不可用时返回enabled=false', async () => {
      const cacheWithoutRedis = new EmbeddingCacheService()
      // @ts-ignore
      cacheWithoutRedis['redis'] = null
      
      const stats = await cacheWithoutRedis.getStats()
      
      expect(stats.enabled).toBe(false)
      expect(stats.metrics).toBeDefined()
      expect(stats.redisKeys).toBeUndefined()
    })

    it('应该估算正确的内存占用', async () => {
      // 100个缓存键
      const keys = Array.from({ length: 100 }, (_, i) => `key${i}`)
      mockRedis.keys.mockResolvedValue(keys)
      
      const stats = await cache.getStats()
      
      // 100个键 × 4.2KB ≈ 0.41MB
      expect(stats.estimatedMemory).toContain('0.41')
    })

    it('应该在Redis错误时降级返回基础指标', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'))
      
      const stats = await cache.getStats()
      
      expect(stats.enabled).toBe(true)
      expect(stats.metrics).toBeDefined()
      expect(stats.redisKeys).toBeUndefined()
    })
  })

  describe('isEnabled', () => {
    it('应该在Redis配置正确时返回true', () => {
      expect(cache.isEnabled()).toBe(true)
    })

    it('应该在Redis不可用时返回false', () => {
      const cacheWithoutRedis = new EmbeddingCacheService()
      // @ts-ignore
      cacheWithoutRedis['redis'] = null
      
      expect(cacheWithoutRedis.isEnabled()).toBe(false)
    })
  })

  describe('resetMetrics', () => {
    it('应该重置所有指标', async () => {
      // 模拟一些操作
      const vector = new Array(1024).fill(0.1)
      mockRedis.get.mockResolvedValue(JSON.stringify(vector))
      await cache.get('query')
      
      // 重置
      cache.resetMetrics()
      
      mockRedis.keys.mockResolvedValue([])
      const stats = await cache.getStats()
      
      expect(stats.metrics.hits).toBe(0)
      expect(stats.metrics.misses).toBe(0)
      expect(stats.metrics.total).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('应该处理空字符串查询', async () => {
      mockRedis.get.mockResolvedValue(null)
      
      const result = await cache.get('')
      
      expect(result).toBeNull()
      // 空字符串trim后仍为空,应该生成缓存键
      expect(mockRedis.get).toHaveBeenCalled()
    })

    it('应该处理超长查询', async () => {
      const longQuery = 'a'.repeat(10000)
      mockRedis.get.mockResolvedValue(null)
      
      const result = await cache.get(longQuery)
      
      expect(result).toBeNull()
      // 应该正常处理,只是hash会固定长度
      expect(mockRedis.get).toHaveBeenCalled()
    })

    it('应该处理中文查询', async () => {
      const chineseQuery = '人工智能是什么？'
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get(chineseQuery)
      
      const cacheKey = mockRedis.get.mock.calls[0][0] as string
      expect(cacheKey).toMatch(/^qv:zhipu:[a-f0-9]{32}$/)
    })

    it('应该处理特殊字符查询', async () => {
      const specialQuery = '什么是AI?!@#$%^&*()'
      mockRedis.get.mockResolvedValue(null)
      
      await cache.get(specialQuery)
      
      expect(mockRedis.get).toHaveBeenCalled()
    })

    it('应该处理空向量', async () => {
      const emptyVector: number[] = []
      
      await cache.set('测试', emptyVector)
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        3600,
        JSON.stringify(emptyVector)
      )
    })
  })
})


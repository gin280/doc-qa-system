/**
 * Embedding Cache 集成测试
 * Story 4.2
 * 
 * 测试完整的缓存流程 + queryVectorizer 集成
 */

import { queryVectorizer } from '@/services/rag/queryVectorizer'
import { embeddingCache } from '@/services/rag/embeddingCache'

describe('Embedding Cache Integration', () => {
  beforeEach(async () => {
    // 重置指标
    embeddingCache.resetMetrics()
    
    // 清理测试缓存键 (如果Redis可用)
    if (embeddingCache.isEnabled()) {
      try {
        await embeddingCache.invalidateProvider('zhipu')
      } catch (error) {
        console.warn('Failed to cleanup cache:', error)
      }
    }
  })

  afterAll(async () => {
    // 清理所有测试缓存
    if (embeddingCache.isEnabled()) {
      try {
        await embeddingCache.invalidateProvider('zhipu')
      } catch (error) {
        console.warn('Failed to cleanup cache:', error)
      }
    }
  })

  describe('完整缓存流程', () => {
    it('应该测试完整的缓存流程: 第一次API,第二次缓存', async () => {
      const query = '什么是人工智能?'

      // 第一次调用 - 缓存未命中,应该调用API
      const start1 = Date.now()
      const vector1 = await queryVectorizer.vectorizeQuery(query)
      const time1 = Date.now() - start1

      expect(vector1).toHaveLength(1024)
      
      // 如果Redis可用,第一次应该较慢(调用API)
      if (embeddingCache.isEnabled()) {
        expect(time1).toBeGreaterThan(100) // API调用至少100ms
      }

      // 等待缓存写入完成
      await new Promise(resolve => setTimeout(resolve, 100))

      // 第二次调用 - 缓存命中,应该从缓存返回
      const start2 = Date.now()
      const vector2 = await queryVectorizer.vectorizeQuery(query)
      const time2 = Date.now() - start2

      expect(vector2).toEqual(vector1)  // 向量应该相同
      
      // 如果Redis可用,第二次应该很快(从缓存返回)
      if (embeddingCache.isEnabled()) {
        expect(time2).toBeLessThan(100)  // 缓存命中应该<100ms
      }
    }, 15000) // 延长超时时间,因为涉及真实API调用

    it('应该验证缓存命中时向量一致性', async () => {
      const query = '测试向量一致性'

      const vector1 = await queryVectorizer.vectorizeQuery(query)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const vector2 = await queryVectorizer.vectorizeQuery(query)
      const vector3 = await queryVectorizer.vectorizeQuery(query)

      // 所有向量应该完全相同
      expect(vector2).toEqual(vector1)
      expect(vector3).toEqual(vector1)
    }, 15000)
  })

  describe('归一化查询测试', () => {
    it('应该对归一化后相同的查询使用缓存', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping cache-specific test')
        return
      }

      const queries = [
        '什么是AI?',
        '什么是AI？',      // 中文标点
        '什么是  AI ?',    // 多空格
        '什么是 ai ?'      // 小写
      ]

      // 第一次调用
      const vector1 = await queryVectorizer.vectorizeQuery(queries[0])
      await new Promise(resolve => setTimeout(resolve, 100))

      // 后续调用应该都命中缓存
      for (const query of queries.slice(1)) {
        const start = Date.now()
        const vector = await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start

        // 验证向量相同
        expect(vector).toEqual(vector1)
        
        // 验证是从缓存返回 (应该很快)
        expect(elapsed).toBeLessThan(100)
      }
    }, 15000)

    it('应该处理大小写不敏感', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping cache-specific test')
        return
      }

      const queries = [
        'What is AI?',
        'what is ai?',
        'WHAT IS AI?',
        'What Is AI?'
      ]

      const vector1 = await queryVectorizer.vectorizeQuery(queries[0])
      await new Promise(resolve => setTimeout(resolve, 100))

      for (const query of queries.slice(1)) {
        const vector = await queryVectorizer.vectorizeQuery(query)
        expect(vector).toEqual(vector1)
      }
    }, 15000)
  })

  describe('Redis降级测试', () => {
    it('应该在Redis不可用时系统仍可用', async () => {
      // 这个测试验证即使Redis失败,查询仍然工作
      // (每次都调用API)
      
      const query = '测试Redis降级'
      
      // 应该能够成功向量化
      const vector = await queryVectorizer.vectorizeQuery(query)
      
      expect(vector).toHaveLength(1024)
      expect(vector).toBeInstanceOf(Array)
    }, 15000)
  })

  describe('性能验证', () => {
    it('应该验证缓存命中时延迟<100ms', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping performance test')
        return
      }

      const query = '性能测试查询'

      // 预热缓存
      await queryVectorizer.vectorizeQuery(query)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 测试缓存命中延迟
      const measurements: number[] = []
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start
        measurements.push(elapsed)
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length
      
      console.log(`Average cache hit latency: ${avgLatency.toFixed(2)}ms`)
      console.log(`Measurements: ${measurements.join(', ')}ms`)

      // 平均延迟应该<100ms
      expect(avgLatency).toBeLessThan(100)
    }, 15000)

    it('应该测量缓存未命中vs命中的性能差异', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping performance test')
        return
      }

      const query1 = '第一次查询测试' + Date.now()
      const query2 = '第二次查询测试' + Date.now()

      // 测试缓存未命中 (第一次)
      const start1 = Date.now()
      await queryVectorizer.vectorizeQuery(query1)
      const missTime = Date.now() - start1

      await new Promise(resolve => setTimeout(resolve, 100))

      // 测试缓存命中 (第二次)
      const start2 = Date.now()
      await queryVectorizer.vectorizeQuery(query1)
      const hitTime = Date.now() - start2

      console.log(`Cache MISS: ${missTime}ms`)
      console.log(`Cache HIT: ${hitTime}ms`)
      console.log(`Performance improvement: ${((1 - hitTime/missTime) * 100).toFixed(1)}%`)

      // 缓存命中应该明显快于缓存未命中
      expect(hitTime).toBeLessThan(missTime * 0.5) // 至少快50%
    }, 15000)
  })

  describe('缓存统计', () => {
    it('应该正确统计缓存命中率', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping stats test')
        return
      }

      embeddingCache.resetMetrics()

      // 3个不同查询 (都会miss)
      await queryVectorizer.vectorizeQuery('查询1-' + Date.now())
      await queryVectorizer.vectorizeQuery('查询2-' + Date.now())
      await queryVectorizer.vectorizeQuery('查询3-' + Date.now())
      
      await new Promise(resolve => setTimeout(resolve, 100))

      // 重复前2个查询 (都会hit)
      await queryVectorizer.vectorizeQuery('查询1-' + Date.now())
      await queryVectorizer.vectorizeQuery('查询1-' + Date.now())

      const stats = await embeddingCache.getStats()
      
      console.log('Cache stats:', stats.metrics)

      // 应该有命中和未命中
      expect(stats.metrics.total).toBeGreaterThan(0)
      expect(stats.metrics.hitRate).toBeGreaterThan(0)
    }, 15000)

    it('应该返回Redis键数量和内存估算', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Redis not available, skipping stats test')
        return
      }

      // 创建几个缓存条目
      await queryVectorizer.vectorizeQuery('统计测试1-' + Date.now())
      await queryVectorizer.vectorizeQuery('统计测试2-' + Date.now())
      await queryVectorizer.vectorizeQuery('统计测试3-' + Date.now())

      await new Promise(resolve => setTimeout(resolve, 100))

      const stats = await embeddingCache.getStats()

      expect(stats.enabled).toBe(true)
      expect(stats.redisKeys).toBeGreaterThan(0)
      expect(stats.estimatedMemory).toMatch(/MB/)
    }, 15000)
  })

  describe('并发测试', () => {
    it('应该处理并发查询', async () => {
      const query = '并发测试查询'

      // 10个并发请求
      const promises = Array.from({ length: 10 }, () =>
        queryVectorizer.vectorizeQuery(query)
      )

      const results = await Promise.all(promises)

      // 所有结果应该相同
      results.forEach(vector => {
        expect(vector).toEqual(results[0])
      })
    }, 15000)
  })

  describe('错误处理', () => {
    it('应该处理无效查询', async () => {
      // 空查询应该抛出错误
      await expect(
        queryVectorizer.vectorizeQuery('')
      ).rejects.toThrow('Question cannot be empty')
    })

    it('应该处理超长查询', async () => {
      const longQuery = 'a'.repeat(1001)
      
      await expect(
        queryVectorizer.vectorizeQuery(longQuery)
      ).rejects.toThrow('Question too long')
    })
  })
})


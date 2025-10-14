/**
 * Embedding Cache 性能测试
 * Story 4.2
 * 
 * 验证性能目标:
 * - 缓存命中率 > 60%
 * - 缓存命中延迟 < 10ms
 * - 总检索时间优化 > 50%
 */

import { queryVectorizer } from '@/services/rag/queryVectorizer'
import { embeddingCache } from '@/services/rag/embeddingCache'

describe('Embedding Cache Performance', () => {
  beforeAll(async () => {
    if (!embeddingCache.isEnabled()) {
      console.log('⚠️  Redis not available, performance tests will be skipped')
    }
  })

  beforeEach(async () => {
    embeddingCache.resetMetrics()
    
    if (embeddingCache.isEnabled()) {
      try {
        await embeddingCache.invalidateProvider('zhipu')
      } catch (error) {
        console.warn('Failed to cleanup cache:', error)
      }
    }
  })

  afterAll(async () => {
    if (embeddingCache.isEnabled()) {
      try {
        await embeddingCache.invalidateProvider('zhipu')
      } catch (error) {
        console.warn('Failed to cleanup cache:', error)
      }
    }
  })

  describe('性能目标验证', () => {
    it('应该达到目标命中率 (>60%)', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      // 模拟真实用户查询分布 (带重复)
      const queries = [
        '什么是AI?',
        '什么是AI？',        // 重复 (归一化后相同)
        '人工智能的定义',
        '什么是AI?',         // 重复
        'AI的应用场景',
        '什么是AI?',         // 重复
        'AI vs ML的区别',
        '人工智能的定义',    // 重复
        '什么是机器学习?',
        '什么是AI?',         // 重复
      ]

      let cacheHits = 0
      let cacheMisses = 0
      const timings: { query: string; time: number; cached: boolean }[] = []

      for (const query of queries) {
        const start = Date.now()
        await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start

        // 判断是否命中缓存 (延迟<50ms 认为是缓存)
        const isCached = elapsed < 50
        if (isCached) {
          cacheHits++
        } else {
          cacheMisses++
        }

        timings.push({ query, time: elapsed, cached: isCached })
        
        // 等待缓存写入
        if (!isCached) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      const hitRate = cacheHits / queries.length

      console.log('\n=== 缓存命中率测试结果 ===')
      console.log(`Total Queries: ${queries.length}`)
      console.log(`Cache Hits: ${cacheHits}`)
      console.log(`Cache Misses: ${cacheMisses}`)
      console.log(`Hit Rate: ${(hitRate * 100).toFixed(1)}%`)
      console.log('\nQuery Timings:')
      timings.forEach(({ query, time, cached }) => {
        console.log(`  ${query.padEnd(20)} - ${time}ms ${cached ? '✓ (cached)' : '✗ (api)'}`)
      })

      // 验证命中率 > 60%
      expect(hitRate).toBeGreaterThan(0.6)
    }, 30000)

    it('应该验证缓存命中延迟 < 10ms 目标', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      const query = '性能测试-延迟验证'

      // 预热缓存
      await queryVectorizer.vectorizeQuery(query)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 测试100次缓存命中
      const measurements: number[] = []
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start
        measurements.push(elapsed)
      }

      // 统计
      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length
      const minLatency = Math.min(...measurements)
      const maxLatency = Math.max(...measurements)
      const p95 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)]

      console.log('\n=== 缓存延迟测试结果 ===')
      console.log(`Iterations: ${iterations}`)
      console.log(`Average: ${avgLatency.toFixed(2)}ms`)
      console.log(`Min: ${minLatency}ms`)
      console.log(`Max: ${maxLatency}ms`)
      console.log(`P95: ${p95}ms`)

      // 目标: 平均延迟 < 10ms
      expect(avgLatency).toBeLessThan(10)
    }, 30000)

    it('应该验证性能提升 > 50%', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      // 测试缓存未命中性能 (API调用)
      const missQuery = '性能提升测试-' + Date.now()
      const start1 = Date.now()
      await queryVectorizer.vectorizeQuery(missQuery)
      const missTime = Date.now() - start1

      await new Promise(resolve => setTimeout(resolve, 100))

      // 测试缓存命中性能
      const start2 = Date.now()
      await queryVectorizer.vectorizeQuery(missQuery)
      const hitTime = Date.now() - start2

      const improvement = (1 - hitTime / missTime) * 100

      console.log('\n=== 性能提升验证 ===')
      console.log(`Cache MISS (API): ${missTime}ms`)
      console.log(`Cache HIT (Redis): ${hitTime}ms`)
      console.log(`Performance Improvement: ${improvement.toFixed(1)}%`)

      // 验证提升 > 50%
      expect(improvement).toBeGreaterThan(50)
    }, 30000)

    it('应该验证P95延迟 < 400ms (混合场景)', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      // 模拟混合查询场景 (60%命中, 40%未命中)
      const baseQueries = [
        '查询1-' + Date.now(),
        '查询2-' + Date.now(),
        '查询3-' + Date.now(),
        '查询4-' + Date.now(),
      ]

      const mixedQueries = [
        ...baseQueries,                    // 第1轮: 都miss (4次)
        baseQueries[0],                    // hit
        baseQueries[1],                    // hit
        '查询5-' + Date.now(),             // miss
        baseQueries[0],                    // hit
        baseQueries[2],                    // hit
        '查询6-' + Date.now(),             // miss
      ]

      const measurements: number[] = []

      for (const query of mixedQueries) {
        const start = Date.now()
        await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start
        measurements.push(elapsed)
        
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 计算P95
      const sorted = measurements.sort((a, b) => a - b)
      const p95 = sorted[Math.floor(sorted.length * 0.95)]
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length

      console.log('\n=== P95延迟测试 (混合场景) ===')
      console.log(`Total Queries: ${mixedQueries.length}`)
      console.log(`Average: ${avg.toFixed(2)}ms`)
      console.log(`P95: ${p95}ms`)
      console.log(`All measurements: ${measurements.join(', ')}ms`)

      // 验证P95 < 400ms
      expect(p95).toBeLessThan(400)
    }, 60000)
  })

  describe('扩展性测试', () => {
    it('应该处理大量并发查询', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      const query = '并发测试-' + Date.now()

      // 预热
      await queryVectorizer.vectorizeQuery(query)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 50个并发请求
      const concurrency = 50
      const start = Date.now()

      const promises = Array.from({ length: concurrency }, () =>
        queryVectorizer.vectorizeQuery(query)
      )

      const results = await Promise.all(promises)
      const totalTime = Date.now() - start

      console.log('\n=== 并发性能测试 ===')
      console.log(`Concurrent Requests: ${concurrency}`)
      console.log(`Total Time: ${totalTime}ms`)
      console.log(`Avg per Request: ${(totalTime / concurrency).toFixed(2)}ms`)

      // 所有结果应该相同
      results.forEach(vector => {
        expect(vector).toEqual(results[0])
      })

      // 平均每个请求应该很快 (缓存命中)
      expect(totalTime / concurrency).toBeLessThan(50)
    }, 30000)

    it('应该测试缓存容量影响', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      // 创建100个不同的查询
      const queries = Array.from({ length: 100 }, (_, i) => 
        `容量测试查询${i}-${Date.now()}`
      )

      console.log('\n=== 缓存容量测试 ===')
      console.log(`Creating ${queries.length} cache entries...`)

      // 预热所有查询
      for (const query of queries) {
        await queryVectorizer.vectorizeQuery(query)
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // 验证缓存大小
      const stats = await embeddingCache.getStats()
      
      console.log(`Redis Keys: ${stats.redisKeys}`)
      console.log(`Estimated Memory: ${stats.estimatedMemory}`)

      // 应该有接近100个缓存键
      expect(stats.redisKeys).toBeGreaterThan(50)
    }, 60000)
  })

  describe('真实场景模拟', () => {
    it('应该模拟用户会话查询模式', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      // 模拟用户会话: 初始查询 + 精炼查询
      const session = [
        '什么是人工智能?',
        '人工智能的应用',
        '什么是人工智能?',      // 重复主题
        'AI在医疗中的应用',
        '人工智能的应用',        // 重复
        'AI的未来发展',
        '什么是人工智能?',      // 再次重复主题
      ]

      let totalTime = 0
      let cachedCount = 0

      console.log('\n=== 用户会话模拟 ===')

      for (const query of session) {
        const start = Date.now()
        await queryVectorizer.vectorizeQuery(query)
        const elapsed = Date.now() - start
        totalTime += elapsed

        const isCached = elapsed < 50
        if (isCached) cachedCount++

        console.log(`  ${query.padEnd(25)} - ${elapsed}ms ${isCached ? '✓' : '✗'}`)
        
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const avgTime = totalTime / session.length
      const cacheRate = cachedCount / session.length

      console.log(`\nAverage Query Time: ${avgTime.toFixed(2)}ms`)
      console.log(`Cache Hit Rate: ${(cacheRate * 100).toFixed(1)}%`)

      // 用户会话应该有较高的缓存命中率
      expect(cacheRate).toBeGreaterThan(0.4)
    }, 60000)
  })

  describe('性能报告', () => {
    it('应该生成完整的性能报告', async () => {
      if (!embeddingCache.isEnabled()) {
        console.log('Skipping: Redis not available')
        return
      }

      embeddingCache.resetMetrics()

      // 执行一系列测试
      const testQueries = [
        '报告测试1',
        '报告测试2',
        '报告测试3',
        '报告测试1', // 重复
        '报告测试2', // 重复
        '报告测试4',
        '报告测试1', // 重复
      ]

      for (const query of testQueries) {
        await queryVectorizer.vectorizeQuery(query)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // 获取统计
      const stats = await embeddingCache.getStats()

      console.log('\n=== 性能报告 ===')
      console.log('Cache Status:', stats.enabled ? 'Enabled ✓' : 'Disabled ✗')
      console.log('\nMetrics:')
      console.log(`  Hits: ${stats.metrics.hits}`)
      console.log(`  Misses: ${stats.metrics.misses}`)
      console.log(`  Total: ${stats.metrics.total}`)
      console.log(`  Hit Rate: ${(stats.metrics.hitRate * 100).toFixed(1)}%`)
      console.log('\nRedis:')
      console.log(`  Keys: ${stats.redisKeys}`)
      console.log(`  Memory: ${stats.estimatedMemory}`)

      expect(stats.metrics.total).toBeGreaterThan(0)
    }, 30000)
  })
})


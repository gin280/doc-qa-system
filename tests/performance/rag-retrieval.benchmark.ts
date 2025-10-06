/**
 * RAG检索性能基准测试
 * Story 3.2 - 验证性能目标
 * 
 * 性能目标：
 * - 向量化延迟 < 300ms (P95)
 * - 向量检索延迟 < 200ms (P95)
 * - 端到端延迟 < 500ms (P95)
 * - 缓存命中率 > 30%
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { db } from '@/lib/db'
import { documents, users, documentChunks } from '../../drizzle/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { retrievalService } from '@/services/rag/retrievalService'
import { queryVectorizer } from '@/services/rag/queryVectorizer'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { vectorConfig } from '@/config/vector.config'

/**
 * 计算百分位数
 */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * p) - 1
  return sorted[index]
}

/**
 * 性能测试结果类型
 */
interface BenchmarkResult {
  p50: number
  p95: number
  p99: number
  avg: number
  min: number
  max: number
  samples: number
}

/**
 * 运行性能基准测试
 */
async function runBenchmark(
  testFn: () => Promise<void>,
  iterations: number = 20
): Promise<BenchmarkResult> {
  const latencies: number[] = []
  
  // 预热（排除冷启动影响）
  for (let i = 0; i < 3; i++) {
    await testFn()
  }
  
  // 正式测试
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await testFn()
    latencies.push(performance.now() - start)
  }
  
  return {
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    avg: latencies.reduce((a, b) => a + b) / latencies.length,
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    samples: latencies.length
  }
}

describe('RAG Retrieval Performance Benchmarks', () => {
  let testUserId: string
  let testDocumentId: string

  beforeAll(async () => {
    testUserId = nanoid()
    testDocumentId = nanoid()
    
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'perf-test@test.com',
      name: 'Performance Test User'
    })
    
    // Create test document with READY status
    await db.insert(documents).values({
      id: testDocumentId,
      userId: testUserId,
      filename: 'performance-test.pdf',
      fileSize: 1024 * 500, // 500KB
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${testDocumentId}.pdf`,
      status: 'READY',
      chunksCount: 50, // More chunks for realistic performance test
      contentLength: 50000,
      uploadedAt: new Date()
    })
    
    // Create 50 test chunks
    const chunks = []
    for (let i = 0; i < 50; i++) {
      chunks.push({
        id: `perf-chunk-${i}`,
        documentId: testDocumentId,
        chunkIndex: i,
        content: `Performance test chunk ${i}. This is sample content about various topics including React, TypeScript, Next.js, and web development best practices.`,
        embeddingId: `perf-chunk-${i}`,
        metadata: {
          pageNumber: Math.floor(i / 5) + 1,
          section: `Section ${Math.floor(i / 10)}`
        }
      })
    }
    await db.insert(documentChunks).values(chunks)
  })

  afterAll(async () => {
    // Cleanup
    await db.delete(documentChunks).where(eq(documentChunks.documentId, testDocumentId))
    await db.delete(documents).where(eq(documents.id, testDocumentId))
    await db.delete(users).where(eq(users.id, testUserId))
  })

  // ============================================================================
  // PERF-001: 查询向量化性能基准
  // ============================================================================
  describe('PERF-001: Query Vectorization Latency', () => {
    it('向量化延迟应该 < 300ms (P95)', async () => {
      const testQuery = 'What is React and how does it work?'
      
      const result = await runBenchmark(async () => {
        await queryVectorizer.vectorizeQuery(testQuery)
      }, 20)
      
      console.log('\n📊 Query Vectorization Performance:')
      console.log(`  P50: ${result.p50.toFixed(2)}ms`)
      console.log(`  P95: ${result.p95.toFixed(2)}ms`)
      console.log(`  P99: ${result.p99.toFixed(2)}ms`)
      console.log(`  Avg: ${result.avg.toFixed(2)}ms`)
      console.log(`  Range: ${result.min.toFixed(2)}ms - ${result.max.toFixed(2)}ms`)
      
      // 验证性能目标
      expect(result.p95).toBeLessThan(300)
      
      // 记录基线数据
      recordPerformanceBaseline('query-vectorization', result)
    })
  })

  // ============================================================================
  // PERF-002: 向量检索性能基准
  // ============================================================================
  describe('PERF-002: Vector Search Latency', () => {
    it('向量检索延迟应该 < 200ms (P95)', async () => {
      // 生成测试向量
      const testVector = await queryVectorizer.vectorizeQuery('test query')
      const vectorRepo = VectorRepositoryFactory.create(vectorConfig)
      
      const result = await runBenchmark(async () => {
        await vectorRepo.search(testVector, {
          topK: 5,
          minScore: 0.3,
          filter: { documentId: testDocumentId, userId: testUserId }
        })
      }, 20)
      
      console.log('\n📊 Vector Search Performance:')
      console.log(`  P50: ${result.p50.toFixed(2)}ms`)
      console.log(`  P95: ${result.p95.toFixed(2)}ms`)
      console.log(`  P99: ${result.p99.toFixed(2)}ms`)
      console.log(`  Avg: ${result.avg.toFixed(2)}ms`)
      
      // 验证性能目标
      expect(result.p95).toBeLessThan(200)
      
      recordPerformanceBaseline('vector-search', result)
    })
  })

  // ============================================================================
  // PERF-003: 端到端检索性能基准
  // ============================================================================
  describe('PERF-003: End-to-End Retrieval Latency', () => {
    it('端到端检索延迟应该 < 500ms (P95)', async () => {
      const testQuery = 'What is React Hooks and how to use useState?'
      
      const result = await runBenchmark(async () => {
        await retrievalService.retrieveContext(
          testQuery,
          testDocumentId,
          testUserId,
          {
            topK: 5,
            minScore: 0.3,
            useCache: false // 禁用缓存以测试纯检索性能
          }
        )
      }, 20)
      
      console.log('\n📊 End-to-End Retrieval Performance:')
      console.log(`  P50: ${result.p50.toFixed(2)}ms`)
      console.log(`  P95: ${result.p95.toFixed(2)}ms`)
      console.log(`  P99: ${result.p99.toFixed(2)}ms`)
      console.log(`  Avg: ${result.avg.toFixed(2)}ms`)
      
      // 验证性能目标
      expect(result.p95).toBeLessThan(500)
      
      recordPerformanceBaseline('end-to-end-retrieval', result)
    })
  })

  // ============================================================================
  // PERF-004: 缓存性能验证
  // ============================================================================
  describe('PERF-004: Cache Hit Rate and Performance', () => {
    it('缓存命中应该显著提升性能', async () => {
      const testQuery = 'Cache performance test query'
      
      // 第一次调用（未缓存）
      const uncachedResult = await runBenchmark(async () => {
        await retrievalService.retrieveContext(
          testQuery,
          testDocumentId,
          testUserId,
          { useCache: true }
        )
      }, 1) // 仅1次以设置缓存
      
      // 等待缓存写入完成
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 第二次调用（应该命中缓存）
      const cachedResult = await runBenchmark(async () => {
        await retrievalService.retrieveContext(
          testQuery,
          testDocumentId,
          testUserId,
          { useCache: true }
        )
      }, 10)
      
      console.log('\n📊 Cache Performance Comparison:')
      console.log(`  Uncached P95: ${uncachedResult.p95.toFixed(2)}ms`)
      console.log(`  Cached P95: ${cachedResult.p95.toFixed(2)}ms`)
      console.log(`  Improvement: ${((1 - cachedResult.p95 / uncachedResult.p95) * 100).toFixed(1)}%`)
      
      // 缓存应该显著提升性能（至少快30%）
      expect(cachedResult.p95).toBeLessThan(uncachedResult.p95 * 0.7)
    })

    it('缓存命中率应该 > 30%', async () => {
      const queries = [
        'What is React?',
        'How to use useState?',
        'What is TypeScript?',
        'How to use Next.js?',
        'What is Tailwind CSS?'
      ]
      
      let cacheHits = 0
      let totalRequests = 0
      
      // 每个查询执行5次
      for (const query of queries) {
        for (let i = 0; i < 5; i++) {
          const result = await retrievalService.retrieveContext(
            query,
            testDocumentId,
            testUserId,
            { useCache: true }
          )
          
          if (result.cached) {
            cacheHits++
          }
          totalRequests++
          
          // 给缓存写入一点时间
          if (i === 0) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }
      
      const hitRate = (cacheHits / totalRequests) * 100
      
      console.log('\n📊 Cache Hit Rate:')
      console.log(`  Total Requests: ${totalRequests}`)
      console.log(`  Cache Hits: ${cacheHits}`)
      console.log(`  Hit Rate: ${hitRate.toFixed(1)}%`)
      
      // 验证缓存命中率目标
      // 期望：第2-5次调用应该命中缓存（理论80%）
      expect(hitRate).toBeGreaterThan(30)
    })
  })

  // ============================================================================
  // PERF-005: 并发性能测试
  // ============================================================================
  describe('PERF-005: Concurrent Request Performance', () => {
    it('应该处理10个并发请求', async () => {
      const concurrency = 10
      const latencies: number[] = []
      
      const promises = Array.from({ length: concurrency }, async (_, i) => {
        const start = performance.now()
        await retrievalService.retrieveContext(
          `Concurrent test query ${i}`,
          testDocumentId,
          testUserId,
          { useCache: false }
        )
        latencies.push(performance.now() - start)
      })
      
      await Promise.all(promises)
      
      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length
      const maxLatency = Math.max(...latencies)
      
      console.log('\n📊 Concurrent Performance (10 requests):')
      console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`)
      console.log(`  Max Latency: ${maxLatency.toFixed(2)}ms`)
      console.log(`  Min Latency: ${Math.min(...latencies).toFixed(2)}ms`)
      
      // 并发下延迟应该合理增加，但不应该线性增长
      expect(avgLatency).toBeLessThan(1000) // 平均 < 1秒
      expect(maxLatency).toBeLessThan(2000) // 最大 < 2秒
    })
  })
})

/**
 * 记录性能基线数据
 * 用于后续性能回归测试
 */
function recordPerformanceBaseline(name: string, result: BenchmarkResult) {
  // TODO: 将基线数据持久化到文件或数据库
  // 可以用于后续的性能回归测试
  const baseline = {
    name,
    timestamp: new Date().toISOString(),
    result,
    environment: {
      node: process.version,
      platform: process.platform
    }
  }
  
  // 开发模式下输出到控制台
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n💾 Performance Baseline Recorded: ${name}`)
  }
}

/**
 * 使用说明：
 * 
 * 1. 运行完整性能测试：
 *    npm test -- tests/performance/rag-retrieval.benchmark.ts
 * 
 * 2. 性能基准测试需要：
 *    - 真实的数据库环境（PostgreSQL + pgvector）
 *    - LLM API key（用于真实的向量化）
 *    - Redis（可选，用于缓存测试）
 * 
 * 3. 性能目标验证：
 *    - 查询向量化: P95 < 300ms
 *    - 向量检索: P95 < 200ms
 *    - 端到端: P95 < 500ms
 *    - 缓存命中率: > 30%
 * 
 * 4. 注意事项：
 *    - 性能受网络、数据库负载等因素影响
 *    - 建议在稳定环境下多次运行取平均值
 *    - 可以根据实际环境调整性能目标
 * 
 * 5. 性能优化建议：
 *    - 如果向量化慢：考虑使用更快的embedding模型
 *    - 如果检索慢：优化pgvector索引参数
 *    - 如果缓存命中率低：优化查询规范化逻辑
 */

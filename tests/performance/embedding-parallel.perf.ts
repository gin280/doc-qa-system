/**
 * Embedding 并行处理性能测试
 * Story 4.8: 批处理并行优化
 * 
 * 验证性能目标:
 * - 小文档 (50 chunks): 性能提升 ≥35%
 * - 中文档 (200 chunks): 性能提升 ≥35%
 * - 大文档 (1000 chunks): 性能提升 ≥35%
 */

import { embedAndStoreChunks } from '@/services/documents/embeddingService'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { llmConfig } from '@/config/llm.config'
import type { ChunkResult } from '@/services/documents/chunkingService'
import { eq } from 'drizzle-orm'

// 性能测试配置
const SIMULATED_API_DELAY = 200 // 模拟API延迟（毫秒）
const BATCH_SIZE = 20

interface PerformanceResult {
  chunkCount: number
  batchCount: number
  parallelTime: number
  sequentialTime: number
  improvement: number
  parallelThroughput: number
  sequentialThroughput: number
}

// 生成测试用的mock chunks
function generateMockChunks(count: number): ChunkResult[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `perf-chunk-${i + 1}`,
    chunkIndex: i,
    content: `性能测试内容 ${i + 1}`.repeat(10),
    length: 100
  }))
}

// 创建带延迟的Mock LLM
function createMockLLM(delay: number) {
  return {
    generateEmbeddings: jest.fn(async (texts: string[]) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return texts.map(() => new Array(1024).fill(0.1))
    })
  }
}

// 创建Mock Vector Repository
function createMockVectorRepo() {
  return {
    upsertBatch: jest.fn().mockResolvedValue(undefined)
  }
}

// 设置测试环境
function setupTestEnvironment() {
  const mockDocument = {
    id: 'perf-test-doc',
    userId: 'perf-test-user',
    status: 'EMBEDDING',
    metadata: {}
  }

  const mockSelect = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([mockDocument])
    })
  })

  const mockUpdate = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined)
    })
  })

  ;(db.select as jest.Mock) = mockSelect
  ;(db.update as jest.Mock) = mockUpdate
  
  jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)
}

// 测试并行处理性能
async function measureParallelProcessing(chunks: ChunkResult[]): Promise<number> {
  const mockLLM = createMockLLM(SIMULATED_API_DELAY)
  const mockVectorRepo = createMockVectorRepo()

  ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
  ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)

  const startTime = Date.now()
  await embedAndStoreChunks('perf-test-doc', chunks)
  const elapsedTime = Date.now() - startTime

  return elapsedTime
}

// 测试顺序处理性能（参考）
async function measureSequentialProcessing(chunks: ChunkResult[]): Promise<number> {
  const batchCount = Math.ceil(chunks.length / BATCH_SIZE)
  const mockLLM = createMockLLM(SIMULATED_API_DELAY)
  
  const startTime = Date.now()
  
  // 模拟顺序处理
  for (let i = 0; i < batchCount; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, chunks.length)
    const batch = chunks.slice(start, end)
    
    // 调用mock LLM
    await mockLLM.generateEmbeddings(batch.map(c => c.content))
  }
  
  const elapsedTime = Date.now() - startTime
  return elapsedTime
}

// 执行性能测试
async function runPerformanceTest(chunkCount: number): Promise<PerformanceResult> {
  console.log(`\n🧪 测试 ${chunkCount} chunks (${Math.ceil(chunkCount / BATCH_SIZE)} 批次)...`)
  
  const chunks = generateMockChunks(chunkCount)
  const batchCount = Math.ceil(chunkCount / BATCH_SIZE)
  
  // 测试顺序处理
  console.log('  ⏱️  测量顺序处理...')
  const sequentialTime = await measureSequentialProcessing(chunks)
  const sequentialThroughput = chunkCount / (sequentialTime / 1000)
  
  // 测试并行处理
  console.log('  ⚡ 测量并行处理...')
  const parallelTime = await measureParallelProcessing(chunks)
  const parallelThroughput = chunkCount / (parallelTime / 1000)
  
  // 计算提升
  const improvement = ((sequentialTime - parallelTime) / sequentialTime) * 100
  
  console.log(`  ✅ 顺序: ${sequentialTime}ms | 并行: ${parallelTime}ms | 提升: ${improvement.toFixed(1)}%`)
  
  return {
    chunkCount,
    batchCount,
    parallelTime,
    sequentialTime,
    improvement,
    parallelThroughput,
    sequentialThroughput
  }
}

describe('Embedding Parallel Performance (Story 4.8)', () => {
  beforeAll(() => {
    console.log('\n📊 批处理并行优化性能测试')
    console.log('=' .repeat(60))
    console.log(`配置: BATCH_SIZE=${BATCH_SIZE}, CONCURRENCY=3, API_DELAY=${SIMULATED_API_DELAY}ms`)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    setupTestEnvironment()
  })

  describe('AC4: 性能提升验证', () => {
    let results: PerformanceResult[] = []

    it('应该在50 chunks时提升≥35%性能', async () => {
      const result = await runPerformanceTest(50)
      results.push(result)
      
      expect(result.improvement).toBeGreaterThanOrEqual(35)
    }, 30000)

    it('应该在200 chunks时提升≥35%性能', async () => {
      const result = await runPerformanceTest(200)
      results.push(result)
      
      expect(result.improvement).toBeGreaterThanOrEqual(35)
    }, 60000)

    it('应该在1000 chunks时提升≥35%性能', async () => {
      const result = await runPerformanceTest(1000)
      results.push(result)
      
      expect(result.improvement).toBeGreaterThanOrEqual(35)
    }, 180000)

    afterAll(() => {
      // 生成性能报告
      console.log('\n📈 性能测试总结')
      console.log('=' .repeat(60))
      console.log('')
      console.log('| Chunks | 批次 | 顺序(ms) | 并行(ms) | 提升 | 通过 |')
      console.log('|--------|------|----------|----------|------|------|')
      
      for (const result of results) {
        const passed = result.improvement >= 35 ? '✅' : '❌'
        console.log(
          `| ${result.chunkCount.toString().padEnd(6)} | ` +
          `${result.batchCount.toString().padEnd(4)} | ` +
          `${result.sequentialTime.toString().padEnd(8)} | ` +
          `${result.parallelTime.toString().padEnd(8)} | ` +
          `${result.improvement.toFixed(1)}% | ` +
          `${passed}   |`
        )
      }
      
      console.log('')
      console.log('💡 吞吐量对比:')
      console.log('-'.repeat(60))
      
      for (const result of results) {
        console.log(`${result.chunkCount} chunks:`)
        console.log(`  顺序: ${result.sequentialThroughput.toFixed(1)} chunks/s`)
        console.log(`  并行: ${result.parallelThroughput.toFixed(1)} chunks/s`)
        console.log(`  提升: ${((result.parallelThroughput / result.sequentialThroughput - 1) * 100).toFixed(1)}%`)
      }
      
      console.log('')
      console.log('🎯 性能目标达成情况:')
      console.log('-'.repeat(60))
      const allPassed = results.every(r => r.improvement >= 35)
      if (allPassed) {
        console.log('✅ 所有测试场景均达到35%性能提升目标')
      } else {
        console.log('❌ 部分测试场景未达到性能目标')
      }
      console.log('=' .repeat(60))
    })
  })

  describe('并发限制验证', () => {
    it('应该保持最大3个并发批次', async () => {
      setupTestEnvironment()
      
      let maxConcurrent = 0
      let currentConcurrent = 0
      
      const mockLLM = {
        generateEmbeddings: jest.fn(async (texts: string[]) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          
          await new Promise(resolve => setTimeout(resolve, 100))
          
          currentConcurrent--
          return texts.map(() => new Array(1024).fill(0.1))
        })
      }
      
      const mockVectorRepo = createMockVectorRepo()
      
      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      const chunks = generateMockChunks(200) // 10批次
      
      await embedAndStoreChunks('perf-test-doc', chunks)
      
      expect(maxConcurrent).toBeLessThanOrEqual(3)
      expect(maxConcurrent).toBeGreaterThan(1)
      
      console.log(`✅ 并发限制验证: 最大并发=${maxConcurrent} (目标≤3)`)
    }, 30000)
  })

  describe('实际API延迟场景', () => {
    it('应该在不同API延迟下保持性能提升', async () => {
      const delays = [100, 200, 500] // 不同的API延迟
      const chunkCount = 100 // 5批次
      
      console.log('\n🔬 不同API延迟场景测试:')
      
      for (const delay of delays) {
        const chunks = generateMockChunks(chunkCount)
        
        // 顺序处理
        const mockLLMSeq = createMockLLM(delay)
        const seqStart = Date.now()
        for (let i = 0; i < Math.ceil(chunkCount / BATCH_SIZE); i++) {
          const start = i * BATCH_SIZE
          const end = Math.min(start + BATCH_SIZE, chunks.length)
          const batch = chunks.slice(start, end)
          await mockLLMSeq.generateEmbeddings(batch.map(c => c.content))
        }
        const seqTime = Date.now() - seqStart
        
        // 并行处理
        const mockLLM = createMockLLM(delay)
        const mockVectorRepo = createMockVectorRepo()
        ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
        ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
        
        const parStart = Date.now()
        await embedAndStoreChunks('perf-test-doc', chunks)
        const parTime = Date.now() - parStart
        
        const improvement = ((seqTime - parTime) / seqTime) * 100
        
        console.log(`  API延迟=${delay}ms: 顺序=${seqTime}ms, 并行=${parTime}ms, 提升=${improvement.toFixed(1)}%`)
        
        expect(improvement).toBeGreaterThan(20) // 至少20%提升
      }
    }, 60000)
  })
})


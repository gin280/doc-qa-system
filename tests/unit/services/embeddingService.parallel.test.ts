/**
 * EmbeddingService 并行处理单元测试
 * Story 4.8: 批处理并行优化
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { embedAndStoreChunks, EmbeddingError } from '@/services/documents/embeddingService'
import { db } from '@/lib/db'
import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { llmConfig } from '@/config/llm.config'
import type { ChunkResult } from '@/services/documents/chunkingService'

// Mock dependencies
jest.mock('@/lib/db')
jest.mock('@/infrastructure/llm/llm-repository.factory')
jest.mock('@/infrastructure/vector/vector-repository.factory')
jest.mock('@/config/llm.config', () => ({
  llmConfig: {
    provider: 'zhipu'
  }
}))
jest.mock('@/config/vector.config')

describe('EmbeddingService - Parallel Processing (Story 4.8)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 重置所有计时器
    jest.clearAllTimers()
  })

  const createMockChunks = (count: number): ChunkResult[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `chunk-${i + 1}`,
      chunkIndex: i,
      content: `测试内容 ${i + 1}`,
      length: 10
    }))
  }

  const setupBasicMocks = () => {
    const mockDocument = {
      id: 'test-doc-id',
      userId: 'test-user',
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

    return { mockDocument, mockSelect, mockUpdate }
  }

  describe('AC1: 并发限制正确工作', () => {
    it('应该同时最多处理3个批次', async () => {
      setupBasicMocks()

      // 记录并发执行的批次
      let currentConcurrent = 0
      let maxConcurrent = 0
      const concurrentHistory: number[] = []

      // Mock LLM API with delay to simulate real processing
      const mockLLM = {
        generateEmbeddings: jest.fn(async (texts: string[]) => {
          currentConcurrent++
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
          concurrentHistory.push(currentConcurrent)
          
          // 模拟API处理时间
          await new Promise(resolve => setTimeout(resolve, 100))
          
          currentConcurrent--
          
          // 返回1024维向量
          return texts.map(() => new Array(1024).fill(0.1))
        })
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      // 创建200个chunks (10批次)
      const chunks = createMockChunks(200)

      await embedAndStoreChunks('test-doc-id', chunks)

      // 验证最大并发数不超过3
      expect(maxConcurrent).toBeLessThanOrEqual(3)
      expect(maxConcurrent).toBeGreaterThan(1) // 确实有并发
      
      // 验证所有批次都被处理
      expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(10)
    }, 15000) // 增加超时时间

    it('应该在批次少于并发数时正常工作', async () => {
      setupBasicMocks()

      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue(
          Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        )
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      // 创建40个chunks (2批次，少于并发数3)
      const chunks = createMockChunks(40)

      await embedAndStoreChunks('test-doc-id', chunks)

      // 应该处理2个批次
      expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(2)
    })
  })

  describe('AC2: 错误处理健壮性', () => {
    it('应该在部分批次失败时继续处理其他批次', async () => {
      setupBasicMocks()

      let callCount = 0
      const mockLLM = {
        generateEmbeddings: jest.fn(async () => {
          callCount++
          
          // 批次2和4失败 (第2次和第4次调用)
          if (callCount === 2 || callCount === 4) {
            throw new Error('API Error')
          }
          
          return Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        })
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      // 创建100个chunks (5批次)
      const chunks = createMockChunks(100)

      // 应该抛出错误，但所有批次都应该被尝试
      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow(EmbeddingError)

      // 验证所有5个批次都被尝试了
      expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(5)
      
      // 验证成功的批次存储了向量 (批次1, 3, 5)
      expect(mockVectorRepo.upsertBatch).toHaveBeenCalledTimes(3)
    })

    it('应该在所有批次成功时正常完成', async () => {
      setupBasicMocks()

      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue(
          Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        )
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      // 创建100个chunks (5批次)
      const chunks = createMockChunks(100)

      await embedAndStoreChunks('test-doc-id', chunks)

      // 验证所有批次都成功处理
      expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(5)
      expect(mockVectorRepo.upsertBatch).toHaveBeenCalledTimes(5)
    })

    it('应该在错误消息中包含失败批次信息', async () => {
      setupBasicMocks()

      let callCount = 0
      const mockLLM = {
        generateEmbeddings: jest.fn(async () => {
          callCount++
          
          // 批次2和4失败
          if (callCount === 2 || callCount === 4) {
            throw new Error('API Error')
          }
          
          return Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        })
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(100)

      try {
        await embedAndStoreChunks('test-doc-id', chunks)
        fail('应该抛出错误')
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingError)
        const embeddingError = error as EmbeddingError
        // 错误消息应该包含失败批次数
        expect(embeddingError.message).toContain('2个批次')
        expect(embeddingError.message).toMatch(/批次.*2,4/)
      }
    })
  })

  describe('AC3: 日志可观测性', () => {
    it('应该记录并行处理的开始和完成', async () => {
      setupBasicMocks()

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue(
          Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        )
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(100)

      await embedAndStoreChunks('test-doc-id', chunks)

      // 验证日志包含关键信息
      const logs = consoleSpy.mock.calls.map(call => call[0]).join('\n')
      
      expect(logs).toContain('开始并行处理')
      expect(logs).toContain('总批次=5')
      expect(logs).toContain('并发数=3')
      expect(logs).toContain('所有批次完成')
      
      consoleSpy.mockRestore()
    })

    it('应该记录每个批次的开始和完成时间', async () => {
      setupBasicMocks()

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue(
          Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        )
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(60) // 3批次

      await embedAndStoreChunks('test-doc-id', chunks)

      const logs = consoleSpy.mock.calls.map(call => call[0]).join('\n')
      
      // 验证每个批次的日志
      expect(logs).toContain('批次 1 开始')
      expect(logs).toContain('批次 1 完成')
      expect(logs).toContain('批次 2 开始')
      expect(logs).toContain('批次 2 完成')
      expect(logs).toContain('批次 3 开始')
      expect(logs).toContain('批次 3 完成')
      
      // 验证包含耗时信息
      expect(logs).toMatch(/\d+\.\d+s/)
      
      consoleSpy.mockRestore()
    })
  })

  describe('AC5: 保持现有错误处理', () => {
    it('应该保留维度验证逻辑', async () => {
      setupBasicMocks()

      // Mock返回错误的维度
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([
          new Array(1536).fill(0.1) // 错误维度：应该是1024
        ])
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(20)

      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow(EmbeddingError)
      
      // 不应该存储任何向量
      expect(mockVectorRepo.upsertBatch).not.toHaveBeenCalled()
    })

    it('应该保留超时控制', async () => {
      setupBasicMocks()

      // Mock一个永不resolve的Promise来模拟超时
      const mockLLM = {
        generateEmbeddings: jest.fn(() => new Promise(() => {}))
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(20)

      // 超时应该被捕获并转换为 EmbeddingError
      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow()
    }, 35000)
  })

  describe('性能验证', () => {
    it('应该比顺序处理更快 (模拟)', async () => {
      setupBasicMocks()

      const processingTime = 100 // 每批次处理时间（毫秒）
      const batchCount = 9 // 9批次

      // 顺序处理预期时间: 9 * 100 = 900ms
      // 并行处理预期时间: 约 9/3 * 100 = 300ms (3个并发)

      const startTime = Date.now()

      const mockLLM = {
        generateEmbeddings: jest.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, processingTime))
          return Array.from({ length: 20 }, () => new Array(1024).fill(0.1))
        })
      }

      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks(180) // 9批次

      await embedAndStoreChunks('test-doc-id', chunks)

      const actualTime = Date.now() - startTime

      // 并行处理应该显著快于顺序处理
      // 实际时间应该远小于顺序处理时间 (900ms)
      // 考虑到测试环境的开销，设置宽松的阈值
      const sequentialTime = batchCount * processingTime
      const maxExpectedTime = sequentialTime * 0.5 // 应该至少快50%

      expect(actualTime).toBeLessThan(maxExpectedTime)
      
      console.log(`性能测试: 实际耗时=${actualTime}ms, 顺序预期=${sequentialTime}ms, 提升=${((sequentialTime - actualTime) / sequentialTime * 100).toFixed(1)}%`)
    }, 15000)
  })
})


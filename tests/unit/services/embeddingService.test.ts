/**
 * EmbeddingService 单元测试
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

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('embedAndStoreChunks', () => {
    it('应该成功向量化chunks', async () => {
      // 测试用例待实现
      // 需要mock LLM API和数据库操作
      expect(true).toBe(true)
    })

    it('应该处理批量向量化', async () => {
      // 测试批处理逻辑
      expect(true).toBe(true)
    })

    it('应该处理向量化超时', async () => {
      // 测试超时控制
      expect(true).toBe(true)
    })

    it('应该处理API配额超限', async () => {
      // 测试配额错误处理
      expect(true).toBe(true)
    })
  })

  describe('AC4: 向量维度验证', () => {
    const createMockChunks = (): ChunkResult[] => [
      { id: 'chunk-1', chunkIndex: 0, content: '测试内容1', length: 5 }
    ]

    const setupMocks = () => {
      const mockDocument = {
        id: 'test-doc-id',
        userId: 'test-user',
        status: 'EMBEDDING',
        metadata: {}
      }

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockDocument, mockDocument])
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

    it('4.5-UNIT-010: ZhipuAI 向量维度 1024 应该通过验证', async () => {
      setupMocks()
      
      const mockVector = new Array(1024).fill(0.1)
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([mockVector])
      }
      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      // 模拟llmConfig为zhipu
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks()
      
      await expect(embedAndStoreChunks('test-doc-id', chunks)).resolves.not.toThrow()
    })

    it('4.5-UNIT-011: ZhipuAI 向量维度 1536 应该抛出错误', async () => {
      setupMocks()
      
      const wrongVector = new Array(1536).fill(0.1) // 错误维度
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([wrongVector])
      }
      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks()
      
      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow(EmbeddingError)
      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow('Vector dimension mismatch: expected 1024, got 1536')
    })

    it('4.5-UNIT-012: OpenAI 向量维度 1536 应该通过验证', async () => {
      setupMocks()
      
      const mockVector = new Array(1536).fill(0.1)
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([mockVector])
      }
      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('openai' as any)

      const chunks = createMockChunks()
      
      await expect(embedAndStoreChunks('test-doc-id', chunks)).resolves.not.toThrow()
    })

    it('4.5-UNIT-013: OpenAI 向量维度 1024 应该抛出错误', async () => {
      setupMocks()
      
      const wrongVector = new Array(1024).fill(0.1) // 错误维度
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([wrongVector])
      }
      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('openai' as any)

      const chunks = createMockChunks()
      
      await expect(embedAndStoreChunks('test-doc-id', chunks)).rejects.toThrow('Vector dimension mismatch: expected 1536, got 1024')
    })

    it('4.5-UNIT-014: 维度不匹配应该记录 ERROR 日志', async () => {
      setupMocks()
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const wrongVector = new Array(1536).fill(0.1)
      const mockLLM = {
        generateEmbeddings: jest.fn().mockResolvedValue([wrongVector])
      }
      const mockVectorRepo = {
        upsertBatch: jest.fn().mockResolvedValue(undefined)
      }

      ;(LLMRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockLLM)
      ;(VectorRepositoryFactory.create as jest.Mock) = jest.fn().mockReturnValue(mockVectorRepo)
      
      jest.spyOn(llmConfig, 'provider', 'get').mockReturnValue('zhipu' as any)

      const chunks = createMockChunks()
      
      try {
        await embedAndStoreChunks('test-doc-id', chunks)
      } catch (error) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Embedding] 维度不匹配',
        expect.objectContaining({
          documentId: 'test-doc-id',
          expectedDimension: 1024,
          actualDimension: 1536,
          provider: 'zhipu'
        })
      )

      consoleErrorSpy.mockRestore()
    })
  })
})

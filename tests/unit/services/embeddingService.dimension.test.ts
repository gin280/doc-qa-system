import { describe, it, expect, vi, beforeEach } from '@jest/globals'
import { embedAndStoreChunks, EmbeddingError } from '@/services/documents/embeddingService'
import { db } from '@/lib/db'
import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import type { ChunkResult } from '@/services/documents/chunkingService'

// Mock dependencies
vi.mock('@/lib/db')
vi.mock('@/infrastructure/llm/llm-repository.factory')
vi.mock('@/infrastructure/vector/vector-repository.factory')

describe('embeddingService - Dimension Validation', () => {
  const mockDocumentId = 'doc-123'
  const mockUserId = 'user-123'
  const mockChunks: ChunkResult[] = [
    {
      id: 'chunk-1',
      chunkIndex: 0,
      content: 'Test content',
      startPos: 0,
      endPos: 12,
      length: 12
    }
  ]

  const mockDocument = {
    id: mockDocumentId,
    userId: mockUserId,
    filename: 'test.pdf',
    status: 'PROCESSING',
    metadata: {}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock db.select().from().where() 查询
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockDocument])
    }
    ;(db.select as any) = vi.fn().mockReturnValue(mockSelect)
    
    // Mock db.update()
    const mockUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({})
    }
    ;(db.update as any) = vi.fn().mockReturnValue(mockUpdate)
  })

  describe('正常情况', () => {
    it('应该在维度匹配时成功处理', async () => {
      // Setup: provider=zhipu, dimension=1024
      const correctVector = new Array(1024).fill(0.1)
      
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([correctVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn().mockResolvedValue(undefined)
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      await expect(embedAndStoreChunks(mockDocumentId, mockChunks))
        .resolves.toBeUndefined()
      
      expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(1)
      expect(mockVectorRepo.upsertBatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('维度不匹配错误', () => {
    it('应该在向量维度不正确时抛出 DIMENSION_MISMATCH 错误', async () => {
      // Setup: 期望1024维，但返回1536维
      const wrongDimensionVector = new Array(1536).fill(0.1)
      
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([wrongDimensionVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn()
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      await expect(embedAndStoreChunks(mockDocumentId, mockChunks))
        .rejects.toThrow(EmbeddingError)
      
      await expect(embedAndStoreChunks(mockDocumentId, mockChunks))
        .rejects.toThrow(/Vector dimension mismatch/)
      
      // 验证错误类型
      try {
        await embedAndStoreChunks(mockDocumentId, mockChunks)
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingError)
        expect((error as EmbeddingError).type).toBe('DIMENSION_MISMATCH')
      }
    })

    it('应该在向量为空时抛出错误', async () => {
      const emptyVector: number[] = []
      
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([emptyVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn()
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      await expect(embedAndStoreChunks(mockDocumentId, mockChunks))
        .rejects.toThrow(EmbeddingError)
    })

    it('应该在向量超长时抛出错误', async () => {
      const tooLongVector = new Array(2048).fill(0.1)
      
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([tooLongVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn()
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      await expect(embedAndStoreChunks(mockDocumentId, mockChunks))
        .rejects.toThrow(EmbeddingError)
    })
  })

  describe('错误日志', () => {
    it('应该记录结构化的错误日志', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const wrongDimensionVector = new Array(1536).fill(0.1)
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([wrongDimensionVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn()
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      try {
        await embedAndStoreChunks(mockDocumentId, mockChunks)
      } catch (error) {
        // Expected
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Embedding] 维度不匹配',
        expect.objectContaining({
          documentId: mockDocumentId,
          expectedDimension: 1024,
          actualDimension: 1536,
          provider: 'zhipu'
        })
      )
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('错误消息内容', () => {
    it('应该包含详细的错误消息和恢复建议', async () => {
      const wrongDimensionVector = new Array(1536).fill(0.1)
      
      const mockLLM = {
        generateEmbeddings: vi.fn().mockResolvedValue([wrongDimensionVector])
      }
      
      const mockVectorRepo = {
        upsertBatch: vi.fn()
      }
      
      vi.spyOn(LLMRepositoryFactory, 'create').mockReturnValue(mockLLM as any)
      vi.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
      
      try {
        await embedAndStoreChunks(mockDocumentId, mockChunks)
        throw new Error('Should have thrown EmbeddingError')
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingError)
        const embError = error as EmbeddingError
        expect(embError.message).toContain('Vector dimension mismatch detected')
        expect(embError.message).toContain('Expected: 1024D')
        expect(embError.message).toContain('Received: 1536D')
        expect(embError.message).toContain('Possible causes')
        expect(embError.message).toContain('Recovery')
      }
    })
  })
})


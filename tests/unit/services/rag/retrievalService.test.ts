/**
 * RetrievalService 单元测试
 * Story 4.3 - 完整的RAG检索服务测试套件
 * 
 * 覆盖率目标:
 * - 行覆盖率 ≥ 90%
 * - 分支覆盖率 ≥ 85%
 * - 函数覆盖率 = 100%
 */

import { RetrievalService, RetrievalError } from '@/services/rag/retrievalService'
import { QueryVectorizationError } from '@/services/rag/queryVectorizer'
import type { RetrievalResult } from '@/types/rag'

// ==================== Mock Setup ====================

// Mock queryVectorizer
const mockVectorizeQuery = jest.fn()
jest.mock('@/services/rag/queryVectorizer', () => ({
  queryVectorizer: {
    vectorizeQuery: (...args: any[]) => mockVectorizeQuery(...args)
  },
  QueryVectorizationError: class QueryVectorizationError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'QueryVectorizationError'
    }
  }
}))

// Mock queryCacheService
const mockGetCachedResult = jest.fn()
const mockSetCachedResult = jest.fn()
const mockInvalidateDocumentCache = jest.fn()
const mockIsEnabled = jest.fn()

jest.mock('@/services/rag/queryCacheService', () => ({
  queryCacheService: {
    isEnabled: () => mockIsEnabled(),
    getCachedResult: (...args: any[]) => mockGetCachedResult(...args),
    setCachedResult: (...args: any[]) => mockSetCachedResult(...args),
    invalidateDocumentCache: (...args: any[]) => mockInvalidateDocumentCache(...args)
  }
}))

// Mock VectorRepository
const mockVectorSearch = jest.fn()
jest.mock('@/infrastructure/vector/vector-repository.factory', () => ({
  VectorRepositoryFactory: {
    create: jest.fn(() => ({
      search: (...args: any[]) => mockVectorSearch(...args)
    }))
  }
}))

// Mock Drizzle DB
const mockWhere = jest.fn()
const mockFrom = jest.fn(() => ({
  where: mockWhere
}))
const mockSelect = jest.fn(() => ({
  from: mockFrom
}))

jest.mock('@/lib/db', () => ({
  db: {
    select: () => mockSelect()
  }
}))

// ==================== Test Data ====================

const mockDocument = {
  id: 'doc-123',
  userId: 'user-456',
  status: 'READY',
  filename: 'test.pdf',
  createdAt: new Date(),
  updatedAt: new Date()
}

const mockVector = new Array(1024).fill(0).map(() => Math.random())

const mockVectorResults = [
  {
    id: 'chunk-1',
    score: 0.85,
    metadata: {
      documentId: 'doc-123',
      chunkIndex: 0,
      content: 'This is the first chunk.',
      pageNumber: 1
    }
  },
  {
    id: 'chunk-2',
    score: 0.75,
    metadata: {
      documentId: 'doc-123',
      chunkIndex: 1,
      content: 'This is the second chunk.',
      pageNumber: 1
    }
  }
]

const mockCachedResult: RetrievalResult = {
  chunks: [
    {
      id: 'chunk-1',
      documentId: 'doc-123',
      chunkIndex: 0,
      content: 'Cached chunk',
      score: 0.9,
      metadata: { pageNumber: 1 }
    }
  ],
  totalFound: 1,
  query: 'test query',
  documentId: 'doc-123',
  cached: true,
  retrievalTime: 10
}

// ==================== Tests ====================

describe('RetrievalService', () => {
  let service: RetrievalService

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks()
    
    // 默认配置
    mockIsEnabled.mockReturnValue(false)
    
    // 创建服务实例
    service = new RetrievalService()
  })

  // ==================== AC1: 正常流程测试 ====================
  describe('retrieveContext() - AC1: 正常流程', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
    })

    it('应该成功检索并返回相关chunks', async () => {
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456'
      )

      expect(result.chunks).toHaveLength(2)
      expect(result.chunks[0].score).toBe(0.85)
      expect(result.chunks[0].content).toBe('This is the first chunk.')
      expect(result.chunks[1].score).toBe(0.75)
      expect(result.cached).toBe(false)
      expect(result.retrievalTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.retrievalTime).toBe('number')
      expect(result.query).toBe('test query')
      expect(result.documentId).toBe('doc-123')
      expect(result.totalFound).toBe(2)
    })

    it('应该按相似度降序排序chunks', async () => {
      const unorderedResults = [
        { ...mockVectorResults[1], score: 0.65 },
        { ...mockVectorResults[0], score: 0.95 },
        { ...mockVectorResults[0], score: 0.75, id: 'chunk-3', metadata: { ...mockVectorResults[0].metadata, chunkIndex: 2 } }
      ]
      
      mockVectorSearch.mockResolvedValue(unorderedResults)
      
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456'
      )
      
      expect(result.chunks[0].score).toBe(0.95)
      expect(result.chunks[1].score).toBe(0.75)
      expect(result.chunks[2].score).toBe(0.65)
    })

    it('应该在分数相同时按chunkIndex升序排序', async () => {
      const sameScoreResults = [
        { id: 'chunk-3', score: 0.8, metadata: { documentId: 'doc-123', chunkIndex: 3, content: 'C', pageNumber: 2 } },
        { id: 'chunk-1', score: 0.8, metadata: { documentId: 'doc-123', chunkIndex: 1, content: 'A', pageNumber: 1 } },
        { id: 'chunk-2', score: 0.8, metadata: { documentId: 'doc-123', chunkIndex: 2, content: 'B', pageNumber: 1 } }
      ]
      
      mockVectorSearch.mockResolvedValue(sameScoreResults)
      
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456'
      )
      
      // 分数相同时应该按索引升序
      expect(result.chunks[0].chunkIndex).toBe(1)
      expect(result.chunks[1].chunkIndex).toBe(2)
      expect(result.chunks[2].chunkIndex).toBe(3)
    })

    it('应该并行执行文档验证和查询向量化', async () => {
      const calls: string[] = []
      
      mockWhere.mockImplementation(async () => {
        calls.push('verify')
        return [mockDocument]
      })
      
      mockVectorizeQuery.mockImplementation(async () => {
        calls.push('vectorize')
        return mockVector
      })
      
      await service.retrieveContext('test', 'doc-123', 'user-456')
      
      // 验证两个操作都被调用
      expect(calls).toContain('verify')
      expect(calls).toContain('vectorize')
    })

    it('应该正确计算retrievalTime', async () => {
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456'
      )
      
      expect(typeof result.retrievalTime).toBe('number')
      expect(result.retrievalTime).toBeGreaterThanOrEqual(0)
      expect(result.retrievalTime).toBeLessThan(10000) // 应该是合理的时间范围
    })
  })

  // ==================== AC2: 输入验证测试 ====================
  describe('retrieveContext() - AC2: 输入验证', () => {
    it('应该拒绝空查询', async () => {
      await expect(
        service.retrieveContext('', 'doc-123', 'user-456')
      ).rejects.toThrow(RetrievalError)
      
      await expect(
        service.retrieveContext('', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'INVALID_QUERY',
        message: 'Query cannot be empty'
      })
    })

    it('应该拒绝只有空格的查询', async () => {
      await expect(
        service.retrieveContext('   ', 'doc-123', 'user-456')
      ).rejects.toThrow(RetrievalError)
      
      await expect(
        service.retrieveContext('   ', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'INVALID_QUERY'
      })
    })

    it('应该拒绝超过1000字符的查询', async () => {
      const longQuery = 'a'.repeat(1001)
      
      await expect(
        service.retrieveContext(longQuery, 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'INVALID_QUERY',
        message: 'Query too long (max 1000 characters)'
      })
    })

    it('应该接受恰好1000字符的查询', async () => {
      const maxQuery = 'a'.repeat(1000)
      
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext(
        maxQuery,
        'doc-123',
        'user-456'
      )
      
      expect(result.chunks).toBeDefined()
    })

    it('应该自动trim查询字符串', async () => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext(
        '  test query  ',
        'doc-123',
        'user-456'
      )
      
      expect(result.query).toBe('test query')
      expect(mockVectorizeQuery).toHaveBeenCalledWith('test query')
    })
  })

  // ==================== AC3: 文档权限验证测试 ====================
  describe('retrieveContext() - AC3: 文档权限验证', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockVectorizeQuery.mockResolvedValue(mockVector)
    })

    it('应该在文档不存在时抛出DOCUMENT_NOT_FOUND', async () => {
      mockWhere.mockResolvedValue([]) // 空结果
      
      await expect(
        service.retrieveContext('test', 'nonexistent-doc', 'user-456')
      ).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found or access denied'
      })
    })

    it('应该在用户无权访问文档时抛出DOCUMENT_NOT_FOUND', async () => {
      mockWhere.mockResolvedValue([]) // 模拟WHERE条件不匹配
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'wrong-user')
      ).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_FOUND'
      })
    })

    it('应该在文档状态为PROCESSING时抛出DOCUMENT_NOT_READY', async () => {
      const processingDoc = { ...mockDocument, status: 'PROCESSING' }
      mockWhere.mockResolvedValue([processingDoc])
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_READY',
        message: expect.stringContaining('not ready yet')
      })
    })

    it('应该在文档状态为FAILED时抛出DOCUMENT_NOT_READY', async () => {
      const failedDoc = { ...mockDocument, status: 'FAILED' }
      mockWhere.mockResolvedValue([failedDoc])
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_READY'
      })
    })

    it('应该接受状态为READY的文档', async () => {
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks).toBeDefined()
    })
  })

  // ==================== AC4: 缓存逻辑测试 ====================
  describe('retrieveContext() - AC4: 缓存逻辑', () => {
    it('应该在缓存命中时直接返回缓存结果', async () => {
      mockIsEnabled.mockReturnValue(true)
      mockGetCachedResult.mockResolvedValue(mockCachedResult)
      
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456',
        { useCache: true }
      )
      
      expect(result).toEqual(mockCachedResult)
      expect(result.cached).toBe(true)
      
      // 验证不调用向量化和检索
      expect(mockVectorizeQuery).not.toHaveBeenCalled()
      expect(mockVectorSearch).not.toHaveBeenCalled()
    })

    it('应该在缓存未命中时执行检索并写入缓存', async () => {
      mockIsEnabled.mockReturnValue(true)
      mockGetCachedResult.mockResolvedValue(null)
      mockSetCachedResult.mockResolvedValue(undefined)
      
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456',
        { useCache: true }
      )
      
      expect(result.cached).toBe(false)
      
      // 验证调用了缓存写入
      expect(mockSetCachedResult).toHaveBeenCalledWith(
        'doc-123',
        'test query',
        expect.objectContaining({
          chunks: expect.any(Array),
          cached: false
        })
      )
    })

    it('应该在useCache=false时跳过缓存', async () => {
      mockIsEnabled.mockReturnValue(true)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456',
        { useCache: false }
      )
      
      // 验证不检查缓存
      expect(mockGetCachedResult).not.toHaveBeenCalled()
      expect(mockSetCachedResult).not.toHaveBeenCalled()
    })

    it('应该在缓存服务disabled时不使用缓存', async () => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456',
        { useCache: true }
      )
      
      expect(mockGetCachedResult).not.toHaveBeenCalled()
      expect(mockSetCachedResult).not.toHaveBeenCalled()
    })

    it('应该在缓存写入失败时不影响主流程', async () => {
      mockIsEnabled.mockReturnValue(true)
      mockGetCachedResult.mockResolvedValue(null)
      mockSetCachedResult.mockRejectedValue(
        new Error('Cache write failed')
      )
      
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      // 应该成功完成（缓存失败不影响主流程）
      const result = await service.retrieveContext(
        'test query',
        'doc-123',
        'user-456'
      )
      
      expect(result.chunks).toBeDefined()
    })
  })

  // ==================== AC5: 无相关内容场景测试 ====================
  describe('retrieveContext() - AC5: 无相关内容场景', () => {
    it('应该在向量检索返回空结果时抛出NO_RELEVANT_CONTENT', async () => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue([]) // 空结果
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'NO_RELEVANT_CONTENT',
        message: 'No relevant content found'
      })
    })

    it('应该在NO_RELEVANT_CONTENT错误中提供友好的消息', async () => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue([])
      
      try {
        await service.retrieveContext('test', 'doc-123', 'user-456')
        fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toBe('No relevant content found')
        expect(error.code).toBe('NO_RELEVANT_CONTENT')
      }
    })
  })

  // ==================== AC6: 错误处理测试 ====================
  describe('retrieveContext() - AC6: 错误处理', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
    })

    it('应该正确传播QueryVectorizationError', async () => {
      const vectorError = new QueryVectorizationError(
        'Vectorization failed',
        'VECTORIZATION_ERROR'
      )
      
      mockVectorizeQuery.mockRejectedValue(vectorError)
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toThrow(QueryVectorizationError)
      
      try {
        await service.retrieveContext('test', 'doc-123', 'user-456')
      } catch (error: any) {
        expect(error.code).toBe('VECTORIZATION_ERROR')
      }
    })

    it('应该正确传播RetrievalError', async () => {
      const retrievalError = new RetrievalError(
        'Custom retrieval error',
        'CUSTOM_ERROR'
      )
      
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockRejectedValue(retrievalError)
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toThrow(RetrievalError)
    })

    it('应该将未知错误包装为RETRIEVAL_ERROR', async () => {
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockRejectedValue(new Error('Database error'))
      
      await expect(
        service.retrieveContext('test', 'doc-123', 'user-456')
      ).rejects.toMatchObject({
        code: 'RETRIEVAL_ERROR',
        message: 'Retrieval failed'
      })
    })

    it('应该在错误日志中包含脱敏的query', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // 使用超过50字符的查询，确保被截断
      const longQuery = 'This is a very long sensitive query that contains more than fifty characters of information'
      mockVectorizeQuery.mockRejectedValue(new Error('Test error'))
      
      try {
        await service.retrieveContext(longQuery, 'doc-123', 'user-456')
      } catch (error) {
        // 预期错误
      }
      
      expect(consoleSpy).toHaveBeenCalled()
      const logCall = consoleSpy.mock.calls[0][1]
      // 应该被截断到50字符（加上省略号后缀）
      expect(logCall.query).toHaveLength(53) // 50个字符 + '...'
      expect(logCall.query).toContain('...')
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 参数测试 ====================
  describe('retrieveContext() - topK 参数测试', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
    })

    it('应该返回最多topK个chunks', async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`,
        score: 0.9 - i * 0.01,
        metadata: {
          documentId: 'doc-123',
          chunkIndex: i,
          content: `Chunk ${i}`,
          pageNumber: 1
        }
      }))
      
      mockVectorSearch.mockResolvedValue(manyResults)
      
      const result = await service.retrieveContext(
        'test',
        'doc-123',
        'user-456',
        { topK: 3 }
      )
      
      expect(result.chunks).toHaveLength(3)
      expect(result.totalFound).toBe(20)
    })

    it('应该使用默认topK=5', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        score: 0.9 - i * 0.01,
        metadata: {
          documentId: 'doc-123',
          chunkIndex: i,
          content: `Chunk ${i}`,
          pageNumber: 1
        }
      }))
      
      mockVectorSearch.mockResolvedValue(manyResults)
      
      const result = await service.retrieveContext(
        'test',
        'doc-123',
        'user-456'
      )
      
      expect(result.chunks).toHaveLength(5)
    })

    it('应该在结果少于topK时返回所有结果', async () => {
      mockVectorSearch.mockResolvedValue(mockVectorResults) // 只有2个结果
      
      const result = await service.retrieveContext(
        'test',
        'doc-123',
        'user-456',
        { topK: 10 }
      )
      
      expect(result.chunks).toHaveLength(2)
    })
  })

  describe('retrieveContext() - minScore 参数测试', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(mockVectorResults)
    })

    it('应该将minScore传递给vectorRepo.search', async () => {
      await service.retrieveContext(
        'test',
        'doc-123',
        'user-456',
        { minScore: 0.7 }
      )
      
      expect(mockVectorSearch).toHaveBeenCalledWith(
        mockVector,
        expect.objectContaining({
          minScore: 0.7
        })
      )
    })

    it('应该使用默认minScore=0.3', async () => {
      await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(mockVectorSearch).toHaveBeenCalledWith(
        mockVector,
        expect.objectContaining({
          minScore: 0.3
        })
      )
    })

    it('应该在search调用中包含filter参数', async () => {
      await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(mockVectorSearch).toHaveBeenCalledWith(
        mockVector,
        expect.objectContaining({
          filter: {
            documentId: 'doc-123',
            userId: 'user-456'
          }
        })
      )
    })

    it('应该使用Math.max(topK, 10)作为搜索topK', async () => {
      await service.retrieveContext('test', 'doc-123', 'user-456', { topK: 3 })
      
      // vectorRepo.search 应该用10而不是3
      expect(mockVectorSearch).toHaveBeenCalledWith(
        mockVector,
        expect.objectContaining({
          topK: 10 // Math.max(3, 10)
        })
      )
    })
  })

  // ==================== 去重测试 ====================
  describe('retrieveContext() - 去重测试', () => {
    it('应该去除ID重复的chunks', async () => {
      const duplicateResults = [
        { id: 'chunk-1', score: 0.9, metadata: { documentId: 'doc-123', chunkIndex: 0, content: 'A', pageNumber: 1 } },
        { id: 'chunk-1', score: 0.85, metadata: { documentId: 'doc-123', chunkIndex: 0, content: 'A', pageNumber: 1 } },
        { id: 'chunk-2', score: 0.8, metadata: { documentId: 'doc-123', chunkIndex: 1, content: 'B', pageNumber: 1 } }
      ]
      
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(duplicateResults)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks).toHaveLength(2)
      expect(result.chunks[0].id).toBe('chunk-1')
      expect(result.chunks[1].id).toBe('chunk-2')
    })

    it('应该保留第一次出现的重复chunk', async () => {
      const duplicateResults = [
        { id: 'chunk-1', score: 0.9, metadata: { documentId: 'doc-123', chunkIndex: 0, content: 'First', pageNumber: 1 } },
        { id: 'chunk-1', score: 0.85, metadata: { documentId: 'doc-123', chunkIndex: 0, content: 'Second', pageNumber: 1 } }
      ]
      
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
      mockVectorSearch.mockResolvedValue(duplicateResults)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks).toHaveLength(1)
      expect(result.chunks[0].content).toBe('First')
    })
  })

  // ==================== invalidateDocumentCache 测试 ====================
  describe('invalidateDocumentCache()', () => {
    it('应该调用queryCacheService.invalidateDocumentCache', async () => {
      mockInvalidateDocumentCache.mockResolvedValue(undefined)
      
      await service.invalidateDocumentCache('doc-123')
      
      expect(mockInvalidateDocumentCache).toHaveBeenCalledWith('doc-123')
    })

    it('应该传播缓存失效错误', async () => {
      mockInvalidateDocumentCache.mockRejectedValue(new Error('Cache error'))
      
      await expect(
        service.invalidateDocumentCache('doc-123')
      ).rejects.toThrow('Cache error')
    })
  })

  // ==================== 边界情况测试 ====================
  describe('边界情况', () => {
    beforeEach(() => {
      mockIsEnabled.mockReturnValue(false)
      mockWhere.mockResolvedValue([mockDocument])
      mockVectorizeQuery.mockResolvedValue(mockVector)
    })

    it('应该处理metadata中缺少section字段的chunks', async () => {
      const resultsWithoutSection = [
        {
          id: 'chunk-1',
          score: 0.85,
          metadata: {
            documentId: 'doc-123',
            chunkIndex: 0,
            content: 'Test chunk',
            pageNumber: 1
            // section字段缺失
          }
        }
      ]
      
      mockVectorSearch.mockResolvedValue(resultsWithoutSection)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks[0].metadata.section).toBeUndefined()
    })

    it('应该正确处理非常高的相似度分数', async () => {
      const highScoreResults = [
        {
          id: 'chunk-1',
          score: 0.9999,
          metadata: {
            documentId: 'doc-123',
            chunkIndex: 0,
            content: 'Perfect match',
            pageNumber: 1
          }
        }
      ]
      
      mockVectorSearch.mockResolvedValue(highScoreResults)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks[0].score).toBe(0.9999)
    })

    it('应该正确处理接近minScore阈值的结果', async () => {
      const borderlineResults = [
        {
          id: 'chunk-1',
          score: 0.3001,
          metadata: {
            documentId: 'doc-123',
            chunkIndex: 0,
            content: 'Borderline match',
            pageNumber: 1
          }
        }
      ]
      
      mockVectorSearch.mockResolvedValue(borderlineResults)
      
      const result = await service.retrieveContext('test', 'doc-123', 'user-456')
      
      expect(result.chunks[0].score).toBe(0.3001)
    })

    it('应该处理包含特殊字符的查询', async () => {
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext(
        '什么是AI?!@#$%',
        'doc-123',
        'user-456'
      )
      
      expect(result.query).toBe('什么是AI?!@#$%')
    })

    it('应该处理多语言查询', async () => {
      mockVectorSearch.mockResolvedValue(mockVectorResults)
      
      const result = await service.retrieveContext(
        'What is 人工智能 in English?',
        'doc-123',
        'user-456'
      )
      
      expect(result.query).toBe('What is 人工智能 in English?')
    })
  })
})


/**
 * Query Cache Service 单元测试
 */

import { QueryCacheService } from '@/services/rag/queryCacheService'
import type { RetrievalResult } from '@/types/rag'

// Mock Upstash Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn(),
    del: jest.fn()
  }))
}))

import { Redis } from '@upstash/redis'

describe('QueryCacheService', () => {
  let cacheService: QueryCacheService
  let mockRedis: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // 设置环境变量
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    
    cacheService = new QueryCacheService()
    mockRedis = (Redis as jest.Mock).mock.results[0].value
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  describe('getCachedResult', () => {
    it('应该返回缓存的检索结果', async () => {
      // Arrange
      const documentId = 'doc123'
      const query = '测试问题'
      const mockResult: RetrievalResult = {
        chunks: [],
        totalFound: 0,
        query,
        documentId,
        cached: false,
        retrievalTime: 100
      }
      mockRedis.get.mockResolvedValue(mockResult)

      // Act
      const result = await cacheService.getCachedResult(documentId, query)

      // Assert
      expect(result).toEqual({ ...mockResult, cached: true })
      expect(mockRedis.get).toHaveBeenCalledWith(expect.stringContaining(documentId))
    })

    it('缓存未命中时应该返回null', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null)

      // Act
      const result = await cacheService.getCachedResult('doc123', '测试问题')

      // Assert
      expect(result).toBeNull()
    })

    it('应该处理相同问题的不同大小写', async () => {
      // Arrange
      const documentId = 'doc123'
      const query1 = 'TEST QUERY'
      const query2 = 'test query'
      const mockResult: RetrievalResult = {
        chunks: [],
        totalFound: 0,
        query: query1,
        documentId,
        cached: false,
        retrievalTime: 100
      }
      mockRedis.get.mockResolvedValue(mockResult)

      // Act
      const result1 = await cacheService.getCachedResult(documentId, query1)
      const result2 = await cacheService.getCachedResult(documentId, query2)

      // Assert
      // 应该使用相同的缓存键
      const calls = mockRedis.get.mock.calls
      expect(calls[0][0]).toBe(calls[1][0])
    })

    it('Redis失败时应该返回null而不抛出错误', async () => {
      // Arrange
      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      // Act
      const result = await cacheService.getCachedResult('doc123', '测试问题')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('setCachedResult', () => {
    it('应该缓存检索结果并设置TTL', async () => {
      // Arrange
      const documentId = 'doc123'
      const query = '测试问题'
      const result: RetrievalResult = {
        chunks: [],
        totalFound: 0,
        query,
        documentId,
        cached: false,
        retrievalTime: 100
      }
      mockRedis.setex.mockResolvedValue('OK')

      // Act
      await cacheService.setCachedResult(documentId, query, result)

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        30 * 60, // 30分钟TTL
        JSON.stringify(result)
      )
    })

    it('Redis失败时应该静默失败', async () => {
      // Arrange
      mockRedis.setex.mockRejectedValue(new Error('Redis error'))
      const result: RetrievalResult = {
        chunks: [],
        totalFound: 0,
        query: '测试问题',
        documentId: 'doc123',
        cached: false,
        retrievalTime: 100
      }

      // Act & Assert
      await expect(
        cacheService.setCachedResult('doc123', '测试问题', result)
      ).resolves.not.toThrow()
    })
  })

  describe('invalidateDocumentCache', () => {
    it('应该删除文档相关的所有缓存', async () => {
      // Arrange
      const documentId = 'doc123'
      const mockKeys = [
        'rag:query:doc123:hash1',
        'rag:query:doc123:hash2',
        'rag:query:doc123:hash3'
      ]
      mockRedis.keys.mockResolvedValue(mockKeys)
      mockRedis.del.mockResolvedValue(3)

      // Act
      await cacheService.invalidateDocumentCache(documentId)

      // Assert
      expect(mockRedis.keys).toHaveBeenCalledWith(`rag:query:${documentId}:*`)
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys)
    })

    it('没有缓存键时不应该调用del', async () => {
      // Arrange
      mockRedis.keys.mockResolvedValue([])

      // Act
      await cacheService.invalidateDocumentCache('doc123')

      // Assert
      expect(mockRedis.del).not.toHaveBeenCalled()
    })

    it('Redis失败时应该静默失败', async () => {
      // Arrange
      mockRedis.keys.mockRejectedValue(new Error('Redis error'))

      // Act & Assert
      await expect(
        cacheService.invalidateDocumentCache('doc123')
      ).resolves.not.toThrow()
    })
  })

  describe('isEnabled', () => {
    it('Redis配置正确时应该返回true', () => {
      expect(cacheService.isEnabled()).toBe(true)
    })

    it('Redis未配置时应该返回false', () => {
      // Arrange
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN
      const newService = new QueryCacheService()

      // Act & Assert
      expect(newService.isEnabled()).toBe(false)
    })
  })
})

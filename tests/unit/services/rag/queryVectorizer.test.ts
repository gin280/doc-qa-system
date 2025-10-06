/**
 * Query Vectorizer 单元测试
 */

// 导入实际的EMBEDDING_DIMENSION常量
import { EMBEDDING_DIMENSION } from '@/config/llm.config'

jest.mock('@/config/llm.config', () => ({
  llmConfig: {
    provider: 'zhipu',
    zhipu: {
      apiKey: 'test-key',
      model: 'glm-4'
    }
  },
  EMBEDDING_DIMENSION: 1024 // 智谱AI embedding-2 固定维度
}))

// 使用 jest.fn() 函数形式避免初始化顺序问题
const mockGenerateEmbeddings = jest.fn()

jest.mock('@/infrastructure/llm/llm-repository.factory', () => ({
  LLMRepositoryFactory: {
    create: jest.fn(() => ({
      generateEmbeddings: (...args: any[]) => mockGenerateEmbeddings(...args)
    }))
  }
}))

import { queryVectorizer, QueryVectorizationError } from '@/services/rag/queryVectorizer'

describe('QueryVectorizer', () => {
  beforeEach(() => {
    mockGenerateEmbeddings.mockClear()
  })

  describe('vectorizeQuery', () => {
    it('应该成功向量化有效的查询问题', async () => {
      // Arrange
      const testQuery = '什么是人工智能？'
      const mockVector = new Array(EMBEDDING_DIMENSION).fill(0.1)
      mockGenerateEmbeddings.mockResolvedValue([mockVector])

      // Act
      const result = await queryVectorizer.vectorizeQuery(testQuery)

      // Assert
      expect(result).toEqual(mockVector)
      expect(result.length).toBe(EMBEDDING_DIMENSION)
      expect(mockGenerateEmbeddings).toHaveBeenCalledWith([testQuery])
    })

    it('应该拒绝空查询', async () => {
      // Act & Assert
      await expect(queryVectorizer.vectorizeQuery('')).rejects.toThrow(QueryVectorizationError)
      await expect(queryVectorizer.vectorizeQuery('   ')).rejects.toThrow(QueryVectorizationError)
    })

    it('应该拒绝过长的查询（>1000字符）', async () => {
      // Arrange
      const longQuery = 'a'.repeat(1001)

      // Act & Assert
      await expect(queryVectorizer.vectorizeQuery(longQuery)).rejects.toThrow(QueryVectorizationError)
    })

    it('应该接受1000字符的查询', async () => {
      // Arrange
      const maxLengthQuery = 'a'.repeat(1000)
      const mockVector = new Array(EMBEDDING_DIMENSION).fill(0.1)
      mockGenerateEmbeddings.mockResolvedValue([mockVector])

      // Act
      const result = await queryVectorizer.vectorizeQuery(maxLengthQuery)

      // Assert
      expect(result.length).toBe(EMBEDDING_DIMENSION)
    })

    it('应该处理embedding API失败', async () => {
      // Arrange
      mockGenerateEmbeddings.mockRejectedValue(new Error('API Error'))

      // Act & Assert
      await expect(queryVectorizer.vectorizeQuery('测试问题')).rejects.toThrow(QueryVectorizationError)
    })

    it('应该处理embedding API超时', async () => {
      // Arrange
      mockGenerateEmbeddings.mockRejectedValue(new Error('ETIMEDOUT: connection timeout'))

      // Act & Assert
      const error = await queryVectorizer.vectorizeQuery('测试问题').catch(e => e)
      expect(error).toBeInstanceOf(QueryVectorizationError)
      expect(error.code).toBe('EMBEDDING_TIMEOUT')
    })

    it('应该处理API配额超限', async () => {
      // Arrange
      const quotaError = new Error('API quota exceeded')
      mockGenerateEmbeddings.mockRejectedValue(quotaError)

      // Act & Assert
      const error = await queryVectorizer.vectorizeQuery('测试问题').catch(e => e)
      expect(error).toBeInstanceOf(QueryVectorizationError)
      expect(error.code).toBe('QUOTA_EXCEEDED')
    })

    it('应该验证向量维度', async () => {
      // Arrange
      const wrongDimVector = new Array(512).fill(0.1) // 错误的维度
      mockGenerateEmbeddings.mockResolvedValue([wrongDimVector])

      // Act & Assert
      await expect(queryVectorizer.vectorizeQuery('测试问题')).rejects.toThrow(QueryVectorizationError)
    })

    it('应该处理空的embedding响应', async () => {
      // Arrange
      mockGenerateEmbeddings.mockResolvedValue([])

      // Act & Assert
      await expect(queryVectorizer.vectorizeQuery('测试问题')).rejects.toThrow(QueryVectorizationError)
    })

    it('应该自动trim查询字符串', async () => {
      // Arrange
      const testQuery = '  测试问题  '
      const mockVector = new Array(EMBEDDING_DIMENSION).fill(0.1)
      mockGenerateEmbeddings.mockResolvedValue([mockVector])

      // Act
      await queryVectorizer.vectorizeQuery(testQuery)

      // Assert
      expect(mockGenerateEmbeddings).toHaveBeenCalledWith(['测试问题'])
    })
  })
})

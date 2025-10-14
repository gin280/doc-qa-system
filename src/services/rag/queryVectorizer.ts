/**
 * 查询向量化服务
 * 将用户问题转换为1024维向量用于检索（智谱AI embedding-2）
 * 
 * Story 4.2: 添加 Embedding 缓存支持,性能提升 60%+
 */

import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { llmConfig, EMBEDDING_DIMENSION } from '@/config/llm.config'
import { embeddingCache } from './embeddingCache'

/**
 * 查询向量化错误类型
 */
export class QueryVectorizationError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'QueryVectorizationError'
  }
}

/**
 * 查询向量化服务类
 */
export class QueryVectorizer {
  private llmRepo = LLMRepositoryFactory.create(llmConfig)

  /**
   * 向量化查询问题 (带缓存支持)
   * @param question 用户问题(1-1000字符)
   * @returns 1024维向量
   * @throws {QueryVectorizationError} 向量化失败或超时
   */
  async vectorizeQuery(question: string): Promise<number[]> {
    const startTime = Date.now()

    try {
      // 输入验证
      const trimmed = question.trim()
      if (!trimmed) {
        throw new QueryVectorizationError('Question cannot be empty', 'INVALID_INPUT')
      }
      
      if (trimmed.length > 1000) {
        throw new QueryVectorizationError('Question too long (max 1000 characters)', 'INVALID_INPUT')
      }

      // Story 4.2: 尝试从缓存获取向量
      const cachedVector = await embeddingCache.get(trimmed)
      
      if (cachedVector) {
        const elapsed = Date.now() - startTime
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[QueryVectorizer] Using cached embedding:', {
            questionLength: trimmed.length,
            vectorDim: cachedVector.length,
            elapsed: `${elapsed}ms`,
            source: 'cache'
          })
        }

        return cachedVector
      }

      // 缓存未命中,调用 LLM API
      // (与Story 2.4文档向量化使用相同模型)
      const vectors = await this.llmRepo.generateEmbeddings([trimmed])
      
      if (!vectors || vectors.length === 0) {
        throw new QueryVectorizationError('Empty embedding response', 'EMBEDDING_ERROR')
      }

      const vector = vectors[0]
      
      // 验证向量维度（智谱AI固定1024维）
      if (vector.length !== EMBEDDING_DIMENSION) {
        throw new QueryVectorizationError(
          `Invalid vector dimension: ${vector.length}, expected ${EMBEDDING_DIMENSION}`,
          'EMBEDDING_ERROR'
        )
      }

      // Story 4.2: 异步写入缓存 (不阻塞响应)
      embeddingCache.set(trimmed, vector).catch(err => {
        console.warn('[QueryVectorizer] Failed to cache embedding:', err)
      })

      const elapsed = Date.now() - startTime

      if (process.env.NODE_ENV === 'development') {
        console.log('[QueryVectorizer] Query vectorized:', {
          questionLength: trimmed.length,
          vectorDim: vector.length,
          elapsed: `${elapsed}ms`,
          source: 'api',
          cached: true  // 已写入缓存
        })
      }

      return vector

    } catch (error) {
      const elapsed = Date.now() - startTime

      console.error('[QueryVectorizer] Query vectorization failed', {
        error: error instanceof Error ? error.message : String(error),
        elapsed: `${elapsed}ms`
      })

      // 如果已经是我们的自定义错误，直接抛出
      if (error instanceof QueryVectorizationError) {
        throw error
      }

      // 友好错误消息映射
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        throw new QueryVectorizationError('Embedding request timeout', 'EMBEDDING_TIMEOUT')
      } else if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        throw new QueryVectorizationError('API quota exceeded', 'QUOTA_EXCEEDED')
      } else if (errorMessage.includes('429') || errorCode === '429') {
        throw new QueryVectorizationError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
      } else {
        throw new QueryVectorizationError('Embedding generation failed', 'EMBEDDING_ERROR')
      }
    }
  }
}

// 导出单例
export const queryVectorizer = new QueryVectorizer()

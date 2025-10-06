/**
 * RAG检索服务
 * 编排完整的检索流程：权限验证、向量化、检索、缓存
 */

import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { queryVectorizer, QueryVectorizationError } from './queryVectorizer'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { vectorConfig } from '@/config/vector.config'
import { queryCacheService } from './queryCacheService'
import type { RetrievalResult, RetrievalOptions, RetrievalChunk } from '@/types/rag'

/**
 * 检索错误类型
 */
export class RetrievalError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'RetrievalError'
  }
}

/**
 * RAG检索服务类
 */
export class RetrievalService {
  private vectorRepo = VectorRepositoryFactory.create(vectorConfig)

  /**
   * 检索相关上下文
   * @param query 用户问题
   * @param documentId 文档ID
   * @param userId 用户ID
   * @param options 检索选项
   * @returns 检索结果
   */
  async retrieveContext(
    query: string,
    documentId: string,
    userId: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now()
    const {
      topK = 5,
      minScore = 0.3,  // 余弦相似度阈值：0.3可以召回相关内容同时过滤无关内容
      useCache = true
    } = options

    try {
      // 1. 输入验证
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        throw new RetrievalError('Query cannot be empty', 'INVALID_QUERY')
      }
      
      if (trimmedQuery.length > 1000) {
        throw new RetrievalError('Query too long (max 1000 characters)', 'INVALID_QUERY')
      }

      // 2. 检查缓存
      if (useCache && queryCacheService.isEnabled()) {
        const cached = await queryCacheService.getCachedResult(documentId, trimmedQuery)
        if (cached) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[RetrievalService] Cache hit:', {
              documentId,
              queryLength: trimmedQuery.length,
              cached: true
            })
          }
          return cached
        }
      }

      // 3. 并行执行：文档权限验证 + 查询向量化
      const [, queryVector] = await Promise.all([
        this.verifyDocumentAccess(documentId, userId),
        queryVectorizer.vectorizeQuery(trimmedQuery)
      ])

      const vectorizeTime = Date.now() - startTime

      // 4. 向量相似度检索
      const searchStartTime = Date.now()
      
      // 调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[RetrievalService] Calling vectorRepo.search with:', {
          queryVectorLength: queryVector.length,
          topK: Math.max(topK, 10),
          minScore,
          documentId,
          userId
        })
      }
      
      const vectorResults = await this.vectorRepo.search(queryVector, {
        topK: Math.max(topK, 10), // 多取一些结果用于过滤
        minScore,
        filter: { documentId, userId }
      })
      const searchTime = Date.now() - searchStartTime
      
      // 调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[RetrievalService] Vector search completed:', {
          resultsCount: vectorResults.length,
          searchTime: `${searchTime}ms`,
          topScores: vectorResults.slice(0, 3).map(r => r.score)
        })
      }

      // 5. 检查是否有足够的相关结果
      if (vectorResults.length === 0) {
        throw new RetrievalError('No relevant content found', 'NO_RELEVANT_CONTENT')
      }

      // 6. 格式化结果并去重
      const seenIds = new Set<string>()
      const chunks: RetrievalChunk[] = []
      
      for (const r of vectorResults) {
        // 去重
        if (seenIds.has(r.id)) continue
        seenIds.add(r.id)

        // 格式化chunk
        chunks.push({
          id: r.id,
          documentId: r.metadata.documentId,
          chunkIndex: r.metadata.chunkIndex,
          content: r.metadata.content,
          score: r.score,
          metadata: {
            pageNumber: r.metadata.pageNumber,
            section: r.metadata.section
          }
        })

        // 取够 topK 个就停止
        if (chunks.length >= topK) break
      }

      // 7. 按相似度降序、索引升序排序
      chunks.sort((a, b) => {
        // 首先按分数降序
        if (b.score !== a.score) {
          return b.score - a.score
        }
        // 分数相同时按索引升序（保证文档顺序）
        return a.chunkIndex - b.chunkIndex
      })

      const result: RetrievalResult = {
        chunks,
        totalFound: vectorResults.length,
        query: trimmedQuery,
        documentId,
        cached: false,
        retrievalTime: Date.now() - startTime
      }

      // 8. 写入缓存
      if (useCache && queryCacheService.isEnabled()) {
        queryCacheService.setCachedResult(documentId, trimmedQuery, result)
          .catch(err => {
            // 缓存失败不影响主流程
            console.warn('[RetrievalService] Failed to cache result:', err.message)
          })
      }

      // 9. 记录日志 (AC10: 查询内容脱敏，仅记录前50字符)
      if (process.env.NODE_ENV === 'development') {
        console.log('[RetrievalService] Retrieval completed:', {
          userId,
          documentId,
          query: trimmedQuery.slice(0, 50) + (trimmedQuery.length > 50 ? '...' : ''), // 脱敏处理
          queryLength: trimmedQuery.length,
          vectorizeTime: `${vectorizeTime}ms`,
          searchTime: `${searchTime}ms`,
          totalTime: `${result.retrievalTime}ms`,
          chunksFound: chunks.length,
          maxScore: chunks[0]?.score?.toFixed(3),
          cached: false,
          topK
        })
      }

      return result

    } catch (error) {
      const elapsed = Date.now() - startTime
      
      // 错误日志也进行查询内容脱敏
      console.error('[RetrievalService] Retrieval failed:', {
        userId,
        documentId,
        query: query.slice(0, 50) + (query.length > 50 ? '...' : ''), // 脱敏处理
        error: error instanceof Error ? error.message : String(error),
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        elapsed: `${elapsed}ms`
      })

      // 如果已经是我们的自定义错误，直接抛出
      if (error instanceof RetrievalError || error instanceof QueryVectorizationError) {
        throw error
      }

      // 其他错误统一包装
      throw new RetrievalError('Retrieval failed', 'RETRIEVAL_ERROR')
    }
  }

  /**
   * 验证文档访问权限
   * @param documentId 文档ID
   * @param userId 用户ID
   * @returns 文档信息
   * @private
   */
  private async verifyDocumentAccess(
    documentId: string, 
    userId: string
  ): Promise<{ id: string; status: string; vectorized?: boolean }> {
    try {
      const [doc] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.userId, userId)
          )
        )

      if (!doc) {
        throw new RetrievalError('Document not found or access denied', 'DOCUMENT_NOT_FOUND')
      }

      if (doc.status !== 'READY') {
        throw new RetrievalError(
          'Document is not ready yet. Please wait for processing to complete.',
          'DOCUMENT_NOT_READY'
        )
      }

      return doc
    } catch (error) {
      if (error instanceof RetrievalError) {
        throw error
      }
      throw new RetrievalError('Failed to verify document access', 'ACCESS_VERIFICATION_ERROR')
    }
  }

  /**
   * 批量失效文档缓存
   * 用于文档更新或删除时
   */
  async invalidateDocumentCache(documentId: string): Promise<void> {
    await queryCacheService.invalidateDocumentCache(documentId)
  }
}

// 导出单例
export const retrievalService = new RetrievalService()

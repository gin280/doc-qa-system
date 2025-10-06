import { db } from '@/lib/db'
import { documentChunks, documents } from '@/drizzle/schema'
import { sql, eq, and, inArray } from 'drizzle-orm'
import type {
  IVectorRepository,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult
} from './vector-repository.interface'

/**
 * pgvector实现
 * 使用PostgreSQL的pgvector扩展存储和检索向量
 */
export class PgVectorRepository implements IVectorRepository {
  async upsert(document: VectorDocument): Promise<void> {
    await db.insert(documentChunks).values({
      id: document.id,
      documentId: document.metadata.documentId,
      chunkIndex: document.metadata.chunkIndex,
      content: document.metadata.content || '',
      embeddingId: document.id,
      metadata: document.metadata
    }).onConflictDoUpdate({
      target: documentChunks.id,
      set: {
        metadata: document.metadata
      }
    })

    // 更新embedding向量
    const vectorString = `[${document.vector.join(',')}]`
    await db.execute(sql`
      UPDATE document_chunks 
      SET embedding = ${vectorString}::vector
      WHERE id = ${document.id}
    `)
  }

  async upsertBatch(documents: VectorDocument[]): Promise<void> {
    if (documents.length === 0) return

    // 批量插入基础记录（如果不存在）
    const values = documents.map(doc => ({
      id: doc.id,
      documentId: doc.metadata.documentId,
      chunkIndex: doc.metadata.chunkIndex,
      content: doc.metadata.content || '',
      embeddingId: doc.id,
      metadata: doc.metadata
    }))
    
    await db.insert(documentChunks)
      .values(values)
      .onConflictDoUpdate({
        target: documentChunks.id,
        set: {
          metadata: sql`excluded.metadata`
        }
      })

    // 批量更新embedding向量
    for (const doc of documents) {
      const vectorString = `[${doc.vector.join(',')}]`
      await db.execute(sql`
        UPDATE document_chunks 
        SET embedding = ${vectorString}::vector
        WHERE id = ${doc.id}
      `)
    }
  }

  async search<T = any>(
    vector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult<T>[]> {
    const { topK = 10, filter, minScore = 0 } = options
    const vectorString = `[${vector.join(',')}]`

    // 调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[PgVectorRepository] Filter received:', filter)
      console.log('[PgVectorRepository] Query vector stats:', {
        length: vector.length,
        first5: vector.slice(0, 5),
        sum: vector.reduce((a, b) => a + b, 0),
        avg: vector.reduce((a, b) => a + b, 0) / vector.length
      })
    }

    // 构建WHERE条件
    const conditions: any[] = []
    
    // 处理特殊过滤条件：documentId 和 userId
    if (filter?.documentId) {
      conditions.push(eq(documentChunks.documentId, filter.documentId))
      if (process.env.NODE_ENV === 'development') {
        console.log('[PgVectorRepository] Added documentId condition')
      }
    }
    
    if (filter?.userId) {
      // 通过documents表关联验证用户权限
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${documents} 
          WHERE ${documents.id} = ${documentChunks.documentId}
          AND ${documents.userId} = ${filter.userId}
        )`
      )
      if (process.env.NODE_ENV === 'development') {
        console.log('[PgVectorRepository] Added userId EXISTS condition')
      }
    }

    // 处理其他metadata过滤条件
    if (filter) {
      const metadataFilters = Object.entries(filter)
        .filter(([key]) => key !== 'documentId' && key !== 'userId')
        .map(([key, value]) => 
          sql`${documentChunks.metadata}->>'${sql.raw(key)}' = ${value}`
        )
      
      if (process.env.NODE_ENV === 'development' && metadataFilters.length > 0) {
        console.log('[PgVectorRepository] Added metadata filters:', metadataFilters.length)
      }
      
      conditions.push(...metadataFilters)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[PgVectorRepository] Total conditions before query:', conditions.length)
    }

    try {
      // 构建查询，返回完整的chunk信息
      const results = await db.select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        metadata: documentChunks.metadata,
        // 计算余弦相似度分数(0-1)
        // pgvector的<=>操作符返回余弦距离，相似度 = 1 - 距离
        score: sql<number>`1 - (embedding <=> ${vectorString}::vector)`
      })
      .from(documentChunks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      // 按相似度降序排序
      .orderBy(sql`embedding <=> ${vectorString}::vector`)
      // 多取一些结果，用于阈值过滤后仍有足够结果
      .limit(topK * 2)

      // 调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[PgVectorRepository] Search results:', {
          totalResults: results.length,
          minScore,
          topK,
          scores: results.map(r => r.score).slice(0, 5)
        })
      }

      // 过滤低于阈值的结果
      const filtered = results.filter(r => r.score >= minScore)

      // 调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('[PgVectorRepository] After filtering:', {
          filteredCount: filtered.length,
          topScores: filtered.map(r => r.score).slice(0, 3)
        })
      }

      // 取Top-K
      const topResults = filtered.slice(0, topK)

      // 格式化为标准返回结构，包含完整的chunk信息
      return topResults.map(r => ({
        id: r.id,
        score: r.score,
        metadata: {
          documentId: r.documentId,
          chunkIndex: r.chunkIndex,
          content: r.content,
          ...(r.metadata as Record<string, any>)
        } as T
      }))

    } catch (error) {
      console.error('[PgVectorRepository] Vector search failed:', error)
      throw new Error('VECTOR_SEARCH_ERROR')
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(documentChunks)
      .where(eq(documentChunks.id, id))
  }

  async deleteBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    await db.delete(documentChunks)
      .where(inArray(documentChunks.id, ids))
  }
}

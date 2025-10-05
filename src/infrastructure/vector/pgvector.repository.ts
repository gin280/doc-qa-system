import { db } from '@/lib/db'
import { documentChunks } from '@/drizzle/schema'
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

    // 构建基础查询
    let query = db.select({
      id: documentChunks.id,
      // 余弦相似度: 1 - (a <=> b)
      score: sql<number>`1 - (embedding <=> ${vectorString}::vector)`,
      metadata: documentChunks.metadata
    }).from(documentChunks)

    // 应用过滤条件(根据metadata JSON字段)
    if (filter) {
      const conditions = Object.entries(filter).map(([key, value]) => 
        sql`${documentChunks.metadata}->>'${sql.raw(key)}' = ${value}`
      )
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any
      }
    }

    // 按相似度排序并限制返回数量
    const results = await query
      .orderBy(sql`embedding <=> ${vectorString}::vector`)
      .limit(topK)

    // 过滤低于最小分数的结果
    return results
      .filter(item => item.score >= minScore)
      .map(item => ({
        id: item.id,
        score: item.score,
        metadata: item.metadata as T
      }))
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

/**
 * 向量文档接口
 */
export interface VectorDocument {
  id: string
  vector: number[]
  metadata: Record<string, unknown>
}

/**
 * 向量搜索选项
 */
export interface VectorSearchOptions {
  topK?: number                    // 返回Top-K结果(默认10)
  filter?: Record<string, unknown>     // 过滤条件
  minScore?: number                // 最小相似度阈值(0-1)
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult<T = Record<string, unknown>> {
  id: string
  score: number    // 相似度分数(0-1)
  metadata: T
}

/**
 * 通用向量存储接口
 * 所有向量数据库实现必须遵循此接口
 */
export interface IVectorRepository {
  /**
   * 插入或更新单个向量
   */
  upsert(document: VectorDocument): Promise<void>

  /**
   * 批量插入或更新向量
   */
  upsertBatch(documents: VectorDocument[]): Promise<void>

  /**
   * 向量相似度搜索
   */
  search<T = Record<string, unknown>>(
    vector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult<T>[]>

  /**
   * 删除向量
   */
  delete(id: string): Promise<void>

  /**
   * 批量删除向量
   */
  deleteBatch(ids: string[]): Promise<void>
}

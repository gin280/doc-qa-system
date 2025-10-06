/**
 * RAG (Retrieval Augmented Generation) 类型定义
 * 定义检索增强生成系统的核心类型接口
 */

/**
 * 检索到的文档片段
 */
export interface RetrievalChunk {
  /** chunk ID */
  id: string
  /** 所属文档ID */
  documentId: string
  /** chunk序号 */
  chunkIndex: number
  /** 文本内容 */
  content: string
  /** 相似度分数(0-1) */
  score: number
  /** 元信息 */
  metadata?: {
    /** 页码（如适用） */
    pageNumber?: number
    /** 章节名称 */
    section?: string
    /** 其他元信息 */
    [key: string]: unknown
  }
}

/**
 * 检索结果
 */
export interface RetrievalResult {
  /** 检索到的文档片段 */
  chunks: RetrievalChunk[]
  /** 总匹配数 */
  totalFound: number
  /** 原始问题 */
  query: string
  /** 文档ID */
  documentId: string
  /** 是否来自缓存 */
  cached: boolean
  /** 检索耗时(ms) */
  retrievalTime: number
}

/**
 * 检索选项
 */
export interface RetrievalOptions {
  /** Top-K数量(默认5) */
  topK?: number
  /** 最小相似度(默认0.7) */
  minScore?: number
  /** 是否重排序(默认false) */
  rerank?: boolean
  /** 是否使用缓存(默认true) */
  useCache?: boolean
}

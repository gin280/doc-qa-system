import type { IVectorRepository } from './vector-repository.interface'
import { PgVectorRepository } from './pgvector.repository'

export interface VectorConfig {
  provider: 'pgvector' | 'pinecone'
  pgvector?: {
    // pgvector使用现有Drizzle连接
  }
  pinecone?: {
    apiKey: string
    indexName: string
  }
}

/**
 * 向量Repository工厂
 * 根据配置返回对应的向量数据库实现
 */
export class VectorRepositoryFactory {
  static create(config: VectorConfig): IVectorRepository {
    switch (config.provider) {
      case 'pgvector':
        return new PgVectorRepository()
      
      case 'pinecone':
        // 未来实现
        throw new Error('Pinecone implementation not available yet')
      
      default:
        throw new Error(`Unknown vector provider: ${config.provider}`)
    }
  }
}

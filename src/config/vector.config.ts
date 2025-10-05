import type { VectorConfig } from '@/infrastructure/vector/vector-repository.factory'

export const vectorConfig: VectorConfig = {
  // MVP阶段使用pgvector
  provider: (process.env.VECTOR_PROVIDER as 'pgvector' | 'pinecone') || 'pgvector',
  
  pgvector: {
    // pgvector使用现有Drizzle连接
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    indexName: process.env.PINECONE_INDEX || 'docqa-embeddings'
  }
}

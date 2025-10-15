import { db } from '@/lib/db'
import { documents, documentChunks } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { llmConfig } from '@/config/llm.config'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { vectorConfig } from '@/config/vector.config'
import type { ChunkResult } from './chunkingService'

/**
 * 向量化错误
 * 
 * 错误类型:
 * - EMBEDDING_ERROR: 向量生成失败
 * - EMBEDDING_TIMEOUT: 向量生成超时
 * - STORAGE_ERROR: 向量存储失败
 * - QUOTA_EXCEEDED: API配额超限
 * - DIMENSION_MISMATCH: 向量维度不匹配 (配置错误或API返回错误维度)
 * 
 * 维度不匹配问题排查:
 * 1. 检查 llmConfig.provider 是否与 EMBEDDING_DIMENSION 匹配
 * 2. 智谱AI (embedding-2) 应使用 1024维
 * 3. OpenAI (text-embedding-3-small) 应使用 1536维
 * 4. 切换Provider后需要重新处理所有文档
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public type: 'EMBEDDING_ERROR' | 'EMBEDDING_TIMEOUT' | 'STORAGE_ERROR' | 'QUOTA_EXCEEDED' | 'DIMENSION_MISMATCH',
    public cause?: Error
  ) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

/**
 * 获取Provider的预期向量维度
 */
function getExpectedDimension(provider: string): number {
  switch (provider) {
    case 'zhipu':
      return 1024
    case 'openai':
      return 1536
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * 验证Provider与配置的维度是否匹配
 */
function validateProviderDimension(provider: string, dimension: number): void {
  const expectedDimension = getExpectedDimension(provider)
  
  if (dimension !== expectedDimension) {
    throw new EmbeddingError(
      `Configuration mismatch: Provider '${provider}' requires ${expectedDimension}D vectors, but configured dimension is ${dimension}D.\n` +
      `Please update src/config/llm.config.ts to match the provider's embedding dimension.\n` +
      `Expected: ${expectedDimension}D, Got: ${dimension}D`,
      'DIMENSION_MISMATCH'
    )
  }
}

/**
 * 批处理配置
 */
const BATCH_SIZE = 20  // 每批20个chunks
const EMBEDDING_TIMEOUT = 30000  // 30秒超时
const CONCURRENCY = 3  // 并发批次数

/**
 * 并发处理批次 (限制并发数)
 * 
 * @param batches - 批次数组
 * @param processor - 批次处理函数
 * @param concurrency - 并发数
 * @returns 处理结果统计
 */
async function processBatchesInParallel<T>(
  batches: T[][],
  processor: (batch: T[], batchIndex: number) => Promise<void>,
  concurrency: number = CONCURRENCY
): Promise<{ successCount: number; failedBatches: number[] }> {
  const results: { index: number; success: boolean }[] = []
  
  console.log(`[Embedding] 开始并行处理, 总批次=${batches.length}, 并发数=${concurrency}`)
  const startTime = Date.now()
  
  // 使用队列方式控制并发
  const queue: number[] = []
  for (let i = 0; i < batches.length; i++) {
    queue.push(i)
  }
  
  const processBatch = async (batchIndex: number): Promise<void> => {
    const batchStartTime = Date.now()
    console.log(`[Embedding] 批次 ${batchIndex + 1} 开始`)
    
    try {
      await processor(batches[batchIndex], batchIndex)
      const duration = ((Date.now() - batchStartTime) / 1000).toFixed(1)
      console.log(`[Embedding] 批次 ${batchIndex + 1} 完成 (${duration}s)`)
      results.push({ index: batchIndex, success: true })
    } catch (error) {
      const duration = ((Date.now() - batchStartTime) / 1000).toFixed(1)
      console.error(`[Embedding] 批次 ${batchIndex + 1} 失败 (${duration}s):`, error)
      results.push({ index: batchIndex, success: false })
    }
  }
  
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const batchIndex = queue.shift()
      if (batchIndex !== undefined) {
        await processBatch(batchIndex)
      }
    }
  }
  
  // 启动指定数量的并发工作线程
  const workers = Array.from(
    { length: Math.min(concurrency, batches.length) },
    () => worker()
  )
  
  await Promise.all(workers)
  
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
  const successCount = results.filter(r => r.success).length
  const failedBatches = results.filter(r => !r.success).map(r => r.index)
  
  console.log(`[Embedding] 所有批次完成, 总耗时=${totalDuration}s, 成功=${successCount}, 失败=${failedBatches.length}`)
  
  return { successCount, failedBatches }
}

/**
 * 向量化并存储文档chunks
 * 
 * @param documentId - 文档ID
 * @param chunks - 分块结果
 */
export async function embedAndStoreChunks(
  documentId: string,
  chunks: ChunkResult[]
): Promise<void> {
  try {
    // 1. 获取文档信息
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId))
    
    if (!document) {
      throw new EmbeddingError('文档不存在', 'EMBEDDING_ERROR')
    }

    console.log(`[Embedding] Document ${documentId}: 开始向量化, chunks数=${chunks.length}`)

    // 2. 初始化LLM和Vector Repositories
    const llm = LLMRepositoryFactory.create(llmConfig)
    const vectorRepo = VectorRepositoryFactory.create(vectorConfig)

    // 3. 批量处理 - 并行版本
    const batchCount = Math.ceil(chunks.length / BATCH_SIZE)

    // 根据LLM提供商确定向量维度
    const dimension = llmConfig.provider === 'zhipu' ? 1024 : 1536
    
    // 配置一致性检查
    validateProviderDimension(llmConfig.provider, dimension)

    // 3.1 准备所有批次
    const batches: ChunkResult[][] = []
    for (let i = 0; i < batchCount; i++) {
      const start = i * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, chunks.length)
      batches.push(chunks.slice(start, end))
    }

    // 3.2 定义批次处理器
    const processBatch = async (batch: ChunkResult[], batchIndex: number): Promise<void> => {
      // 4. 批量生成embeddings (带超时控制)
      const texts = batch.map(c => c.content)
      const embeddingsPromise = llm.generateEmbeddings(texts)
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding timeout')), EMBEDDING_TIMEOUT)
      )
      
      const vectors = await Promise.race([embeddingsPromise, timeoutPromise])

      // 4.1 验证向量维度
      for (let idx = 0; idx < vectors.length; idx++) {
        const vector = vectors[idx]
        
        if (vector.length !== dimension) {
          const errorMsg = 
            `Vector dimension mismatch detected:\n` +
            `  Expected: ${dimension}D (for provider '${llmConfig.provider}')\n` +
            `  Received: ${vector.length}D\n` +
            `  Chunk: ${batch[idx].chunkIndex} of document ${documentId}\n\n` +
            `Possible causes:\n` +
            `  1. Provider configuration changed after vectors were generated\n` +
            `  2. API returned incorrect embedding dimension\n` +
            `  3. Database schema mismatch\n\n` +
            `Recovery:\n` +
            `  1. Verify llmConfig.provider matches EMBEDDING_DIMENSION\n` +
            `  2. Re-process the document after fixing configuration\n` +
            `  3. Check database vector column dimension`
          
          console.error('[Embedding] 维度不匹配', {
            documentId,
            chunkId: batch[idx].id,
            chunkIndex: batch[idx].chunkIndex,
            expectedDimension: dimension,
            actualDimension: vector.length,
            provider: llmConfig.provider
          })
          
          throw new EmbeddingError(errorMsg, 'DIMENSION_MISMATCH')
        }
      }

      // 5. 准备向量文档并使用Repository批量存储
      const vectorDocuments = batch.map((chunk, idx) => ({
        id: chunk.id,
        vector: vectors[idx],
        metadata: {
          userId: document.userId,
          documentId,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.substring(0, 500), // 截断以节省空间
          length: chunk.length,
          dimension,
          provider: llmConfig.provider
        }
      }))

      // 使用Repository批量存储向量
      await vectorRepo.upsertBatch(vectorDocuments)

      // 更新embeddingId字段
      await Promise.all(
        batch.map(chunk =>
          db.update(documentChunks)
            .set({ embeddingId: chunk.id })
            .where(eq(documentChunks.id, chunk.id))
        )
      )
    }

    // 3.3 并行处理所有批次
    const { successCount, failedBatches } = await processBatchesInParallel(
      batches,
      processBatch,
      CONCURRENCY
    )

    // 3.4 检查是否有失败
    if (failedBatches.length > 0) {
      throw new EmbeddingError(
        `${failedBatches.length}个批次向量化失败 (批次: ${failedBatches.map(i => i + 1).join(',')})`,
        'EMBEDDING_ERROR'
      )
    }

    // 9. 更新文档状态为READY
    const existingMetadata = (document.metadata as Record<string, any>) || {}
    // dimension已经在函数开头定义过了，这里直接使用
    
    await db.update(documents)
      .set({
        status: 'READY',
        chunksCount: chunks.length,
        metadata: {
          ...existingMetadata,
          embedding: {
            vectorCount: chunks.length,
            dimension,
            provider: llmConfig.provider,
            llmModel: llmConfig.provider === 'zhipu' ? 'embedding-2' : 'text-embedding-3-small',
            completedAt: new Date().toISOString()
          }
        }
      })
      .where(eq(documents.id, documentId))

    console.log(`[Embedding] Document ${documentId}: 向量化完成`)

  } catch (error) {
    // 获取当前文档以保留现有metadata
    const [currentDoc] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId))

    // 结构化错误日志
    const errorInfo = {
      timestamp: new Date().toISOString(),
      documentId,
      errorType: error instanceof EmbeddingError ? error.type : 'EMBEDDING_ERROR',
      message: error instanceof Error ? error.message : '未知错误',
      context: {
        chunksCount: chunks.length,
        provider: llmConfig.provider
      }
    }
    
    console.error('[Embedding] 错误:', errorInfo)

    // 更新文档状态为FAILED，保留现有metadata
    await db.update(documents)
      .set({
        status: 'FAILED',
        metadata: {
          ...(currentDoc?.metadata as Record<string, any> || {}),
          error: {
            type: error instanceof EmbeddingError ? error.type : 'EMBEDDING_ERROR',
            message: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date().toISOString()
          }
        }
      })
      .where(eq(documents.id, documentId))

    throw error
  }
}

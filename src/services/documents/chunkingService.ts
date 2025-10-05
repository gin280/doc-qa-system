import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { db } from '@/lib/db'
import { documents, documentChunks } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

/**
 * 分块错误
 */
export class ChunkingError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'ChunkingError'
  }
}

/**
 * 分块结果
 */
export interface ChunkResult {
  id: string
  chunkIndex: number
  content: string
  length: number
}

/**
 * 文档分块服务
 * 
 * @param documentId - 文档ID
 * @returns 分块结果数组
 */
export async function chunkDocument(
  documentId: string
): Promise<ChunkResult[]> {
  try {
    // 1. 获取文档记录
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId))
    
    if (!document) {
      throw new ChunkingError('文档不存在')
    }

    // 2. 检查文档状态(应该是READY from Story 2.3)
    if (document.status !== 'READY') {
      throw new ChunkingError(
        `文档状态错误: ${document.status}, 期望: READY`
      )
    }

    // 3. 更新状态为EMBEDDING
    await db.update(documents)
      .set({ status: 'EMBEDDING' })
      .where(eq(documents.id, documentId))

    // 4. 获取已解析的文本内容
    // 从metadata.content获取(假设Story 2.3存储在这里)
    const metadata = document.metadata as Record<string, any> | null
    const parsedContent = metadata?.content as string
    
    if (!parsedContent) {
      throw new ChunkingError('文档未解析或内容为空')
    }

    console.log(`[Chunking] Document ${documentId}: 开始分块, 文本长度=${parsedContent.length}字符`)

    // 5. 配置分块器
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,        // 每块约1000 tokens
      chunkOverlap: 200,      // 重叠200 tokens保持上下文
      separators: [
        '\n\n',   // 优先按段落
        '\n',     // 其次按换行
        '. ',     // 英文句号
        '。',     // 中文句号
        ' ',      // 空格
        ''        // 字符级别
      ]
    })
    
    // 6. 执行分块
    const chunks = await splitter.createDocuments([parsedContent])
    
    console.log(`[Chunking] 分块完成: ${chunks.length}个chunks`)

    // 7. 保存到数据库
    const chunkRecords = await db.insert(documentChunks).values(
      chunks.map((chunk, index) => ({
        documentId,
        chunkIndex: index,
        content: chunk.pageContent,
        embeddingId: '', // 稍后由embeddingService填充
        metadata: {
          length: chunk.pageContent.length,
        }
      }))
    ).returning()
    
    // 8. 返回分块结果
    return chunkRecords.map(record => ({
      id: record.id,
      chunkIndex: record.chunkIndex,
      content: record.content,
      length: record.content.length
    }))

  } catch (error) {
    console.error('[Chunking] 错误:', error)

    // 获取当前文档以保留现有metadata
    const [currentDoc] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId))

    // 更新文档状态为FAILED，保留现有metadata
    await db.update(documents)
      .set({
        status: 'FAILED',
        metadata: {
          ...(currentDoc?.metadata as Record<string, any> || {}),
          error: {
            type: 'CHUNKING_ERROR',
            message: error instanceof Error ? error.message : '未知错误',
            timestamp: new Date().toISOString()
          }
        }
      })
      .where(eq(documents.id, documentId))

    if (error instanceof ChunkingError) {
      throw error
    }
    throw new ChunkingError('分块失败', error as Error)
  }
}

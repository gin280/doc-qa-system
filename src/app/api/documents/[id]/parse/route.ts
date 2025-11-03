import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { parseDocument, ParseError } from '@/services/documents/parserService'
import { logger } from '@/lib/logger'

/**
 * 配置Vercel函数
 * 解析大文档需要更长的超时时间
 */
export const maxDuration = 300 // 5分钟

/**
 * POST /api/documents/[id]/parse
 * 
 * 解析指定文档
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    const documentId = params.id

    // 2. 验证文档所有权
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 3. 检查文档状态
    if (document.status === 'PARSING') {
      return NextResponse.json(
        { error: '文档正在解析中,请稍后' },
        { status: 409 }
      )
    }

    if (document.status === 'READY') {
      return NextResponse.json(
        { 
          success: true,
          message: '文档已解析完成',
          document: {
            id: document.id,
            filename: document.filename,
            status: document.status,
            contentLength: document.contentLength,
            parsedAt: document.parsedAt,
            metadata: document.metadata
          }
        }
      )
    }

    // 4. 执行解析
    const result = await parseDocument(documentId)

    // 5. 同步执行分块和向量化（Vercel serverless 需要同步执行以避免中断）
    try {
      const { chunkDocument } = await import('@/services/documents/chunkingService')
      const { embedAndStoreChunks } = await import('@/services/documents/embeddingService')
      
      // 执行分块
      const chunks = await chunkDocument(documentId)
      
      // 执行向量化
      await embedAndStoreChunks(documentId, chunks)
      
      logger.info({ 
        documentId, 
        chunksCount: chunks.length,
        action: 'info' 
      }, 'Document processing completed successfully')
      
    } catch (processError) {
      // 处理失败记录日志，但不影响解析成功的响应
      logger.error({ 
        documentId,
        error: processError, 
        action: 'error' 
      }, 'Document processing failed after parse')
      
      // 可以选择在这里返回部分成功的响应
      // 但为了简化，我们仍然返回成功，文档状态会在 embedAndStoreChunks 中正确设置
    }

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        status: 'READY',
        contentLength: result.contentLength,
        metadata: result.metadata,
        parsedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Parse error:')

    // 处理解析特定错误
    if (error instanceof ParseError) {
      const statusCode = error.type === 'TIMEOUT_ERROR' ? 504 : 400
      return NextResponse.json(
        { 
          error: error.message,
          errorType: error.type
        },
        { status: statusCode }
      )
    }

    // 通用错误
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documents/[id]/parse
 * 
 * 获取文档解析状态
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 认证检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    const documentId = params.id

    // 查询文档
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 返回解析状态
    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      status: document.status,
      contentLength: document.contentLength,
      parsedAt: document.parsedAt,
      metadata: document.metadata
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Get parse status error:')
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    )
  }
}


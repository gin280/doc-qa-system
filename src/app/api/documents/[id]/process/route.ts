import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { chunkDocument } from '@/services/documents/chunkingService'
import { embedAndStoreChunks } from '@/services/documents/embeddingService'
import { logger } from '@/lib/logger'

/**
 * 配置Vercel函数
 * 分块和向量化需要更长的超时时间
 */
export const maxDuration = 300 // 5分钟

/**
 * POST /api/documents/[id]/process
 * 
 * 分块并向量化文档
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
    if (document.status === 'EMBEDDING') {
      return NextResponse.json(
        { error: '文档正在处理中,请稍后' },
        { status: 409 }
      )
    }

    if (document.status !== 'READY') {
      return NextResponse.json(
        { 
          error: '文档未解析完成', 
          currentStatus: document.status 
        },
        { status: 400 }
      )
    }

    // 4. 执行分块
    const chunks = await chunkDocument(documentId)

    // 5. 执行向量化
    await embedAndStoreChunks(documentId, chunks)

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        status: 'READY',
        chunksCount: chunks.length
      }
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Process error:')

    // 处理特定错误
    if (error instanceof Error) {
      if (error.name === 'ChunkingError') {
        return NextResponse.json(
          { error: `分块失败: ${error.message}` },
          { status: 400 }
        )
      }
      if (error.name === 'EmbeddingError') {
        return NextResponse.json(
          { error: `向量化失败: ${error.message}` },
          { status: 400 }
        )
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: '处理超时,请稍后重试' },
          { status: 504 }
        )
      }
    }

    // 通用错误
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documents/[id]/process
 * 
 * 获取文档处理状态
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    const documentId = params.id

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

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      status: document.status,
      chunksCount: document.chunksCount,
      metadata: document.metadata
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Get process status error:')
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    )
  }
}

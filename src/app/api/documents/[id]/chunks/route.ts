import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, documentChunks } from '@/drizzle/schema'
import { eq, and, sql } from 'drizzle-orm'

/**
 * GET /api/documents/[id]/chunks
 * 
 * 获取文档的所有chunks列表(支持分页)
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

    // 验证文档所有权
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

    // 获取分页参数
    const searchParams = req.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // 查询chunks
    const chunks = await db.select({
      id: documentChunks.id,
      chunkIndex: documentChunks.chunkIndex,
      content: documentChunks.content,
      embeddingId: documentChunks.embeddingId,
      metadata: documentChunks.metadata,
      createdAt: documentChunks.createdAt
    })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(documentChunks.chunkIndex)
      .limit(limit)
      .offset(offset)

    // 获取总数
    const [{ count }] = await db.select({ 
      count: sql<number>`cast(count(*) as int)` 
    })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))

    return NextResponse.json({
      chunks,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + chunks.length < count
      }
    })

  } catch (error) {
    console.error('Get chunks error:', error)
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    )
  }
}

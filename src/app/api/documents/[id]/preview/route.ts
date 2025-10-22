import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/**
 * GET /api/documents/:id/preview
 * 获取文档预览内容
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

    // 验证文档所有权
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 检查文档是否已解析
    if (document.status !== 'READY' && document.status !== 'EMBEDDING') {
      return NextResponse.json(
        { error: '文档尚未解析完成' },
        { status: 400 }
      )
    }

    // 从metadata中获取解析内容
    // 注意：parserService存储在metadata.content字段
    const metadata = document.metadata as { content?: string } | null
    const content = metadata?.content
    
    if (!content) {
      return NextResponse.json(
        { error: '预览内容不可用' },
        { status: 404 }
      )
    }

    // 返回前500字符(完整内容太大)
    const preview = content.substring(0, 500)
    const truncated = content.length > 500

    return NextResponse.json({
      content: preview,
      truncated,
      totalLength: content.length,
      fileType: document.fileType
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Preview error:')
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

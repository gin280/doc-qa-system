// src/app/api/conversations/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages, documents } from '@/drizzle/schema'
import { eq, and, asc } from 'drizzle-orm'
import { generateMarkdownExport } from '@/services/export/markdownExporter'
import { generateExportFilename } from '@/services/export/exportFormatter'
import { rateLimiter, RATE_LIMITS } from '@/lib/rateLimit'
import type { ConversationExportData } from '@/services/export/markdownExporter'

/**
 * GET /api/conversations/:id/export?format=markdown|pdf
 * 导出单个对话为 Markdown 或 PDF 格式
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 2. 速率限制检查
    const rateLimitKey = `export:${session.user.id}`
    const rateLimitResult = rateLimiter.check(rateLimitKey, RATE_LIMITS.EXPORT)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: '操作过于频繁，请稍后再试',
          resetIn: rateLimitResult.resetIn
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.resetIn.toString(),
            'X-RateLimit-Limit': RATE_LIMITS.EXPORT.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
          }
        }
      )
    }

    const conversationId = params.id
    
    // 仅支持 Markdown 格式

    // 3. 设置速率限制响应头
    const responseHeaders = new Headers()
    responseHeaders.set('X-RateLimit-Limit', RATE_LIMITS.EXPORT.max.toString())
    responseHeaders.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    responseHeaders.set('X-RateLimit-Reset', rateLimitResult.resetIn.toString())

    // 4. 获取对话和消息数据
    const [conversation] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        documentName: documents.filename,
        createdAt: conversations.createdAt
      })
      .from(conversations)
      .leftJoin(documents, eq(conversations.documentId, documents.id))
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, session.user.id)
        )
      )

    if (!conversation) {
      return NextResponse.json(
        { error: '对话不存在或无权访问' },
        { status: 404 }
      )
    }

    // 5. 获取所有消息
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    // 6. 构建导出数据
    const exportData: ConversationExportData = {
      id: conversation.id,
      title: conversation.title,
      documentName: conversation.documentName || '未知文档',
      createdAt: conversation.createdAt,
      messages: messageList.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        citations: msg.citations ? (msg.citations as any[]) : undefined,
        createdAt: msg.createdAt
      }))
    }

    // 7. 生成 Markdown 导出文件
    const fileContent = await generateMarkdownExport(exportData)
    const filename = generateExportFilename(conversation.title, 'markdown')
    const contentType = 'text/markdown; charset=utf-8'

    // 开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Export API] Generated markdown export', {
        conversationId,
        userId: session.user.id,
        filename,
        size: fileContent.length
      })
    }

    // 8. 返回文件（包含速率限制头）
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    responseHeaders.set('Content-Length', fileContent.length.toString())
    responseHeaders.set('Cache-Control', 'no-cache')
    
    return new NextResponse(new Uint8Array(fileContent), {
      headers: responseHeaders
    })

  } catch (error: any) {
    console.error('[Export API] Failed to export conversation', {
      error: error.message,
      conversationId: params.id,
      stack: error.stack
    })

    return NextResponse.json(
      { error: '导出失败，请重试' },
      { status: 500 }
    )
  }
}

// src/app/api/conversations/export-batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages, documents } from '@/drizzle/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { generateMarkdownExport } from '@/services/export/markdownExporter'
import { generateZipExport } from '@/services/export/zipGenerator'
import { generateExportFilename, generateBatchExportFolderName } from '@/services/export/exportFormatter'
import { rateLimiter, RATE_LIMITS } from '@/lib/rateLimit'
import type { ConversationExportData } from '@/services/export/markdownExporter'
import type { ExportFile } from '@/services/export/zipGenerator'
import { getErrorMessage } from '@/types/errors'

interface BatchExportRequest {
  conversationIds: string[]
  format?: 'markdown' // 始终为 markdown
}

/**
 * POST /api/conversations/export-batch
 * 批量导出多个对话为 ZIP 压缩包
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 2. 速率限制检查（批量导出更严格）
    const rateLimitKey = `batch-export:${session.user.id}`
    const rateLimitResult = rateLimiter.check(rateLimitKey, RATE_LIMITS.BATCH_EXPORT)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: '批量导出操作过于频繁，请稍后再试',
          resetIn: rateLimitResult.resetIn
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.resetIn.toString(),
            'X-RateLimit-Limit': RATE_LIMITS.BATCH_EXPORT.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
          }
        }
      )
    }

    // 3. 解析请求体
    const body: BatchExportRequest = await req.json()
    const { conversationIds } = body

    // 4. 验证输入
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: '请选择要导出的对话' },
        { status: 400 }
      )
    }

    if (conversationIds.length > 50) {
      return NextResponse.json(
        { error: '一次最多导出50个对话' },
        { status: 400 }
      )
    }
    
    // 仅支持 Markdown 格式

    // 5. 获取所有对话（验证权限）
    const conversationList = await db
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
          inArray(conversations.id, conversationIds),
          eq(conversations.userId, session.user.id)
        )
      )

    if (conversationList.length === 0) {
      return NextResponse.json(
        { error: '没有找到可导出的对话' },
        { status: 404 }
      )
    }

    // 6. 逐个导出对话
    const exportFiles: ExportFile[] = []

    for (const conversation of conversationList) {
      try {
        // 获取对话的所有消息
        const messageList = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(asc(messages.createdAt))

        // 构建导出数据
        const exportData: ConversationExportData = {
          id: conversation.id,
          title: conversation.title,
          documentName: conversation.documentName || '未知文档',
          createdAt: conversation.createdAt,
          messages: messageList.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            citations: Array.isArray(msg.citations) ? msg.citations : undefined,
            createdAt: msg.createdAt
          }))
        }

        // 生成 Markdown 导出文件
        const fileContent = await generateMarkdownExport(exportData)
        const filename = generateExportFilename(conversation.title, 'markdown')

        exportFiles.push({ filename, content: fileContent })

      } catch (error) {
        console.error(`[Export API] Failed to export conversation ${conversation.id}:`, error)
        // 继续处理其他对话，不中断批量导出
      }
    }

    if (exportFiles.length === 0) {
      return NextResponse.json(
        { error: '所有对话导出失败' },
        { status: 500 }
      )
    }

    // 7. 生成 ZIP 文件
    const folderName = generateBatchExportFolderName()
    const zipBuffer = await generateZipExport(exportFiles, folderName)

    // 开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Export API] Generated batch markdown export', {
        userId: session.user.id,
        requestedCount: conversationIds.length,
        exportedCount: exportFiles.length,
        zipSize: zipBuffer.length
      })
    }

    // 8. 返回 ZIP 文件（包含速率限制头）
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(folderName)}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': RATE_LIMITS.BATCH_EXPORT.max.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
      }
    })

  } catch (error: unknown) {
    console.error('[Export API] Batch export failed', {
      error: getErrorMessage(error)
    })

    return NextResponse.json(
      { error: '批量导出失败，请重试' },
      { status: 500 }
    )
  }
}

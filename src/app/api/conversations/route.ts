// src/app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, documents } from '@/drizzle/schema'
import { eq, desc, and, sql, ilike } from 'drizzle-orm'

/**
 * GET /api/conversations
 * 获取用户的对话列表
 * 
 * Query参数:
 * - page: 页码 (默认1)
 * - limit: 每页数量 (默认20)
 * - documentId: 按文档筛选 (可选)
 * - search: 搜索关键词 (可选)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const documentId = searchParams.get('documentId')
    const search = searchParams.get('search')

    // 3. 构建查询条件
    const conditions = [eq(conversations.userId, session.user.id)]
    
    if (documentId) {
      conditions.push(eq(conversations.documentId, documentId))
    }

    if (search) {
      conditions.push(ilike(conversations.title, `%${search}%`))
    }

    // 4. 查询对话列表（Join documents获取文档名称）
    const offset = (page - 1) * limit
    
    const conversationList = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        documentName: documents.filename,
        messageCount: conversations.messageCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt
      })
      .from(conversations)
      .leftJoin(documents, eq(conversations.documentId, documents.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset)

    // 5. 查询总数
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(...conditions))

    const total = Number(count)
    const hasMore = offset + conversationList.length < total

    // 开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Conversations API] List retrieved', {
        userId: session.user.id,
        page,
        limit,
        total,
        returned: conversationList.length
      })
    }

    return NextResponse.json({
      conversations: conversationList,
      pagination: {
        total,
        page,
        limit,
        hasMore
      }
    })

  } catch (error: any) {
    console.error('[Conversations API] Failed to get conversations', {
      error: error.message,
      stack: error.stack
    })

    return NextResponse.json(
      { error: '获取对话列表失败' },
      { status: 500 }
    )
  }
}

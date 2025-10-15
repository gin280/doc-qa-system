// src/app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { conversations, messages, documents } from '@/drizzle/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getErrorMessage } from '@/types/errors'

/**
 * GET /api/conversations/:id
 * 获取对话详情和所有消息
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

    const conversationId = params.id

    // 2. 查询对话（验证权限）
    const [conversation] = await db
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

    // 3. 查询所有消息
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    // 开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Conversation API] Retrieved', {
        conversationId,
        userId: session.user.id,
        messageCount: messageList.length
      })
    }

    return NextResponse.json({
      conversation,
      messages: messageList
    })

  } catch (error: unknown) {
    console.error('[Conversation API] Failed to get conversation', {
      error: getErrorMessage(error),
      conversationId: params.id
    })

    return NextResponse.json(
      { error: '获取对话详情失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/conversations/:id
 * 删除对话（级联删除消息）
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const conversationId = params.id

    // 2. 验证权限
    const [conversation] = await db
      .select()
      .from(conversations)
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

    // 3. 删除对话（级联删除消息，由数据库外键处理）
    await db
      .delete(conversations)
      .where(eq(conversations.id, conversationId))

    // 开发环境记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[Conversation API] Deleted', {
        conversationId,
        userId: session.user.id
      })
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    console.error('[Conversation API] Failed to delete conversation', {
      error: getErrorMessage(error),
      conversationId: params.id
    })

    return NextResponse.json(
      { error: '删除对话失败' },
      { status: 500 }
    )
  }
}

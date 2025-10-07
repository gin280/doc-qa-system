/**
 * Conversation Service - 对话管理服务
 * Story 3.3: LLM回答生成与流式输出
 * 
 * 处理conversations和messages表的CRUD操作
 */

import { db } from '@/lib/db'
import { conversations, messages } from '@/drizzle/schema'
import { eq, desc, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

/**
 * 对话管理服务
 */
export class ConversationService {
  /**
   * 创建新对话
   * 
   * @param userId 用户ID
   * @param documentId 文档ID
   * @param title 对话标题（可选）
   * @returns 新创建的对话
   */
  async createConversation(
    userId: string,
    documentId: string,
    title?: string
  ) {
    const conversationId = createId()

    const [conversation] = await db
      .insert(conversations)
      .values({
        id: conversationId,
        userId,
        documentId,
        title: title || '新对话', // 默认标题，可以后续根据首个问题更新
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning()

    return conversation
  }

  /**
   * 获取对话详情
   * 
   * @param conversationId 对话ID
   * @param userId 用户ID（用于权限验证）
   * @returns 对话详情
   */
  async getConversation(conversationId: string, userId: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId)
        )
      )

    if (!conversation) {
      throw new Error('CONVERSATION_NOT_FOUND')
    }

    return conversation
  }

  /**
   * 创建用户消息
   * 
   * @param conversationId 对话ID
   * @param content 消息内容
   * @returns 新创建的消息
   */
  async createUserMessage(conversationId: string, content: string) {
    const messageId = createId()

    const [message] = await db
      .insert(messages)
      .values({
        id: messageId,
        conversationId,
        role: 'USER',
        content,
        citations: null,
        tokenCount: 0,
        createdAt: new Date()
      })
      .returning()

    // 更新对话的消息数量和更新时间
    await db
      .update(conversations)
      .set({
        messageCount: db.$count(messages, eq(messages.conversationId, conversationId)),
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))

    return message
  }

  /**
   * 创建AI助手消息
   * 
   * @param conversationId 对话ID
   * @param content 消息内容
   * @param citations 引用数据（可选，Story 3.4将使用）
   * @param tokenCount Token消耗（可选）
   * @returns 新创建的消息
   */
  async createAssistantMessage(
    conversationId: string,
    content: string,
    citations: any[] = [],
    tokenCount: number = 0
  ) {
    const messageId = createId()

    const [message] = await db
      .insert(messages)
      .values({
        id: messageId,
        conversationId,
        role: 'ASSISTANT',
        content,
        citations: citations.length > 0 ? citations : null,
        tokenCount,
        createdAt: new Date()
      })
      .returning()

    // 更新对话的消息数量和更新时间
    await db
      .update(conversations)
      .set({
        messageCount: db.$count(messages, eq(messages.conversationId, conversationId)),
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))

    return message
  }

  /**
   * 获取对话历史
   * 
   * @param conversationId 对话ID
   * @param limit 最多返回多少条消息（默认10）
   * @returns 消息列表（按时间升序）
   */
  async getConversationHistory(conversationId: string, limit: number = 10) {
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)

    // 按时间升序返回（最早的在前）
    return messageList.reverse()
  }

  /**
   * 更新对话标题
   * 
   * @param conversationId 对话ID
   * @param title 新标题
   */
  async updateConversationTitle(conversationId: string, title: string) {
    await db
      .update(conversations)
      .set({
        title,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, conversationId))
  }
}

// 导出单例
export const conversationService = new ConversationService()

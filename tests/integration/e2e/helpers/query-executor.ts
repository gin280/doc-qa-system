/**
 * E2E 测试查询执行辅助函数
 * 提供问答查询、流式响应收集等功能
 */

import { db } from '@/lib/db';
import { conversations, messages } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface QueryResult {
  answer: string;
  conversationId: string;
  messageId: string;
  duration: number;
}

/**
 * 执行查询并收集流式响应
 * @param userId - 用户 ID
 * @param documentId - 文档 ID
 * @param query - 查询文本
 * @param conversationId - 可选的对话 ID
 * @returns 查询结果
 */
export async function executeQuery(
  userId: string,
  documentId: string,
  query: string,
  conversationId?: string
): Promise<QueryResult> {
  const startTime = Date.now();

  console.log(`💬 Executing query: "${query}"`);

  // 构建请求体
  const requestBody: any = {
    query,
    documentId,
  };

  if (conversationId) {
    requestBody.conversationId = conversationId;
  }

  // 调用查询 API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/chat/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createMockAuthToken(userId)}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed: ${response.status} - ${errorText}`);
  }

  // 收集流式响应
  const answer = await collectStreamResponse(response);
  const duration = Date.now() - startTime;

  console.log(`✅ Query completed in ${duration}ms, answer length: ${answer.length}`);

  // 从数据库获取保存的消息
  const messageData = await getLastMessage(userId, answer);

  return {
    answer,
    conversationId: messageData.conversationId,
    messageId: messageData.messageId,
    duration,
  };
}

/**
 * 收集流式响应
 */
async function collectStreamResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join('');
}

/**
 * 从数据库获取最后保存的消息
 */
async function getLastMessage(
  userId: string,
  answerContent: string
): Promise<{ conversationId: string; messageId: string }> {
  // 查找最近的对话
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (!conversation) {
    throw new Error('No conversation found');
  }

  // 查找匹配的 assistant 消息
  const [message] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.role, 'assistant'),
        eq(messages.content, answerContent)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (!message) {
    // 如果找不到精确匹配,返回最新的 assistant 消息
    const [latestMessage] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          eq(messages.role, 'assistant')
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (!latestMessage) {
      throw new Error('No assistant message found');
    }

    return {
      conversationId: conversation.id,
      messageId: latestMessage.id,
    };
  }

  return {
    conversationId: conversation.id,
    messageId: message.id,
  };
}

/**
 * 验证对话历史
 * @param conversationId - 对话 ID
 * @param expectedMessageCount - 期望的消息数量
 */
export async function verifyConversationHistory(
  conversationId: string,
  expectedMessageCount?: number
): Promise<{
  conversation: any;
  messages: any[];
}> {
  // 查询对话
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  // 查询消息
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  if (expectedMessageCount !== undefined && msgs.length !== expectedMessageCount) {
    throw new Error(
      `Expected ${expectedMessageCount} messages, but found ${msgs.length}`
    );
  }

  console.log(
    `✅ Conversation verified: ${conversationId}, ${msgs.length} messages`
  );

  return {
    conversation,
    messages: msgs,
  };
}

/**
 * 执行多个并发查询
 * @param userId - 用户 ID
 * @param documentId - 文档 ID
 * @param queries - 查询列表
 * @returns 查询结果列表
 */
export async function executeConcurrentQueries(
  userId: string,
  documentId: string,
  queries: string[]
): Promise<QueryResult[]> {
  console.log(`💬 Executing ${queries.length} concurrent queries`);

  const startTime = Date.now();

  const queryPromises = queries.map((query) =>
    executeQuery(userId, documentId, query)
  );

  const results = await Promise.all(queryPromises);

  const totalDuration = Date.now() - startTime;
  console.log(`✅ All queries completed in ${totalDuration}ms`);

  return results;
}

/**
 * 创建 Mock Auth Token (用于测试)
 */
function createMockAuthToken(userId: string): string {
  // 在实际测试中,这里应该返回有效的测试 token
  // 或者 API 路由应该有测试模式来接受特殊的测试 token
  return `test-token-${userId}`;
}

/**
 * 测量查询性能
 * @param fn - 查询函数
 * @returns 执行时间和结果
 */
export async function measureQueryPerformance<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await fn();
  const duration = Date.now() - startTime;

  return { result, duration };
}


// tests/unit/db/relationships.test.ts
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals'
import { db } from '../../../src/lib/db'
import { users, documents, conversations, messages, documentChunks, userUsage } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'

describe('Database Relationships and Cascade Delete', () => {
  let testUserId: string
  let testDocumentId: string
  let testConversationId: string

  beforeEach(async () => {
    // 先删除可能存在的测试数据
    await db.delete(users).where(eq(users.email, 'relationship-test@example.com'))
    
    // 创建测试用户
    const [user] = await db.insert(users).values({
      email: 'relationship-test@example.com',
      name: 'Relationship Test User',
    }).returning()
    testUserId = user.id

    // 创建测试文档
    const [document] = await db.insert(documents).values({
      userId: testUserId,
      filename: 'test.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
      storagePath: '/test/test.pdf',
    }).returning()
    testDocumentId = document.id

    // 创建测试会话
    const [conversation] = await db.insert(conversations).values({
      userId: testUserId,
      documentId: testDocumentId,
      title: 'Test Conversation',
    }).returning()
    testConversationId = conversation.id
  })

  afterAll(async () => {
    // 最终清理所有测试数据
    await db.delete(users).where(eq(users.email, 'relationship-test@example.com'))
  })

  it('should create user with document relationship', async () => {
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, testDocumentId))
    
    expect(document).toBeDefined()
    expect(document.userId).toBe(testUserId)
  })

  it('should create user with conversation relationship', async () => {
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.id, testConversationId))
    
    expect(conversation).toBeDefined()
    expect(conversation.userId).toBe(testUserId)
    expect(conversation.documentId).toBe(testDocumentId)
  })

  it('should create document chunks with document relationship', async () => {
    const [chunk] = await db.insert(documentChunks).values({
      documentId: testDocumentId,
      chunkIndex: 0,
      content: 'Test chunk content',
      embeddingId: 'test-embedding-id',
    }).returning()
    
    expect(chunk).toBeDefined()
    expect(chunk.documentId).toBe(testDocumentId)
  })

  it('should cascade delete documents when user is deleted', async () => {
    // 删除用户
    await db.delete(users).where(eq(users.id, testUserId))

    // 验证文档也被删除
    const docs = await db.select()
      .from(documents)
      .where(eq(documents.userId, testUserId))
    
    expect(docs.length).toBe(0)
  })

  it('should cascade delete conversations when user is deleted', async () => {
    // 创建消息
    await db.insert(messages).values({
      conversationId: testConversationId,
      role: 'USER',
      content: 'Test message',
    })

    // 删除用户
    await db.delete(users).where(eq(users.id, testUserId))

    // 验证会话和消息都被删除
    const convs = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, testUserId))
    
    expect(convs.length).toBe(0)
  })

  it('should cascade delete chunks when document is deleted', async () => {
    // 创建文档块
    await db.insert(documentChunks).values({
      documentId: testDocumentId,
      chunkIndex: 0,
      content: 'Test chunk',
      embeddingId: 'test-id',
    })

    // 删除文档
    await db.delete(documents).where(eq(documents.id, testDocumentId))

    // 验证块被删除
    const chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, testDocumentId))
    
    expect(chunks.length).toBe(0)
  })

  it('should create and link user usage', async () => {
    const [usage] = await db.insert(userUsage).values({
      userId: testUserId,
      documentCount: 5,
      storageUsed: 1024000,
      queryCount: 10,
    }).returning()
    
    expect(usage).toBeDefined()
    expect(usage.userId).toBe(testUserId)
    expect(usage.documentCount).toBe(5)
  })

  it('should enforce unique document chunk constraint', async () => {
    // 创建第一个块
    await db.insert(documentChunks).values({
      documentId: testDocumentId,
      chunkIndex: 0,
      content: 'Chunk 1',
      embeddingId: 'id-1',
    })

    // 尝试创建相同documentId和chunkIndex的块应该失败
    await expect(
      db.insert(documentChunks).values({
        documentId: testDocumentId,
        chunkIndex: 0,
        content: 'Chunk 2',
        embeddingId: 'id-2',
      })
    ).rejects.toThrow()
  })
})


// tests/integration/api/conversation-export.test.ts
// 对话导出 API 集成测试

import { NextRequest } from 'next/server'
import { GET as exportHandler } from '@/app/api/conversations/[id]/export/route'
import { POST as batchExportHandler } from '@/app/api/conversations/export-batch/route'
import { db } from '@/lib/db'
import { conversations, messages, users, documents } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { rateLimiter } from '@/lib/rateLimit'

// Mock auth module
jest.mock('@/lib/auth', () => ({
  auth: jest.fn()
}))

import { auth } from '@/lib/auth'
const mockedAuth = auth as jest.MockedFunction<typeof auth>

describe('Conversation Export API - Integration Tests', () => {
  // 测试数据
  let testUserId: string
  let testConversationId: string
  let testDocumentId: string
  let otherUserId: string
  let otherConversationId: string

  beforeAll(async () => {
    // 清理并创建测试数据
    
    // 创建测试用户
    const [user] = await db.insert(users).values({
      id: 'test-user-export-1',
      name: 'Test User Export',
      email: 'test-export@test.com'
    }).returning()
    testUserId = user.id

    const [otherUser] = await db.insert(users).values({
      id: 'test-user-export-2',
      name: 'Other User',
      email: 'other-export@test.com'
    }).returning()
    otherUserId = otherUser.id

    // 创建测试文档
    const [doc] = await db.insert(documents).values({
      id: 'test-doc-export-1',
      userId: testUserId,
      filename: '测试文档.pdf',
      status: 'completed'
    }).returning()
    testDocumentId = doc.id

    // 创建测试对话
    const [conv] = await db.insert(conversations).values({
      id: 'test-conv-export-1',
      userId: testUserId,
      documentId: testDocumentId,
      title: '测试对话导出'
    }).returning()
    testConversationId = conv.id

    // 添加测试消息
    await db.insert(messages).values([
      {
        id: 'msg-1',
        conversationId: testConversationId,
        role: 'USER',
        content: '这是一个测试问题？'
      },
      {
        id: 'msg-2',
        conversationId: testConversationId,
        role: 'ASSISTANT',
        content: '这是测试回答。',
        citations: [
          {
            id: 'cit-1',
            documentName: '测试文档.pdf',
            pageNumber: 1,
            quoteText: '引用文本',
            relevanceScore: 0.95
          }
        ]
      }
    ])

    // 创建其他用户的对话（用于权限测试）
    const [otherConv] = await db.insert(conversations).values({
      id: 'test-conv-export-2',
      userId: otherUserId,
      documentId: testDocumentId,
      title: '其他用户的对话'
    }).returning()
    otherConversationId = otherConv.id
  })

  afterAll(async () => {
    // 清理测试数据
    await db.delete(messages).where(eq(messages.conversationId, testConversationId))
    await db.delete(conversations).where(eq(conversations.id, testConversationId))
    await db.delete(conversations).where(eq(conversations.id, otherConversationId))
    await db.delete(documents).where(eq(documents.id, testDocumentId))
    await db.delete(users).where(eq(users.id, testUserId))
    await db.delete(users).where(eq(users.id, otherUserId))
  })

  beforeEach(() => {
    // 重置 mock
    jest.clearAllMocks()
    
    // 重置速率限制
    rateLimiter.reset(`export:${testUserId}`)
    rateLimiter.reset(`batch-export:${testUserId}`)
  })

  describe('GET /api/conversations/:id/export - 单个导出', () => {
    it('应该成功导出对话为 Markdown', async () => {
      // Mock 认证
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      // 创建请求
      const req = new NextRequest(
        `http://localhost:3000/api/conversations/${testConversationId}/export?format=markdown`
      )

      // 调用处理器
      const response = await exportHandler(req, { params: { id: testConversationId } })

      // 验证响应
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/markdown')
      expect(response.headers.get('Content-Disposition')).toContain('.md')

      // 验证内容
      const buffer = await response.arrayBuffer()
      const content = new TextDecoder().decode(buffer)
      expect(content).toContain('# 对话: 测试对话导出')
      expect(content).toContain('## Q: 这是一个测试问题？')
      expect(content).toContain('这是测试回答。')
      expect(content).toContain('**引用来源**')
    })

    it('应该拒绝未认证的请求（401）', async () => {
      // Mock 未认证
      mockedAuth.mockResolvedValue(null)

      const req = new NextRequest(
        `http://localhost:3000/api/conversations/${testConversationId}/export`
      )

      const response = await exportHandler(req, { params: { id: testConversationId } })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('未授权')
    })

    it('应该拒绝导出他人的对话（404）', async () => {
      // Mock 认证为 testUser，但尝试导出 otherUser 的对话
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      const req = new NextRequest(
        `http://localhost:3000/api/conversations/${otherConversationId}/export`
      )

      const response = await exportHandler(req, { params: { id: otherConversationId } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('对话不存在或无权访问')
    })

    it('应该返回 404 当对话不存在', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      const req = new NextRequest(
        'http://localhost:3000/api/conversations/non-existent-id/export'
      )

      const response = await exportHandler(req, { params: { id: 'non-existent-id' } })

      expect(response.status).toBe(404)
    })

    it('应该在超过速率限制时返回 429', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      // 连续发送 6 次请求（限制是 5 次/分钟）
      for (let i = 0; i < 6; i++) {
        const req = new NextRequest(
          `http://localhost:3000/api/conversations/${testConversationId}/export`
        )
        const response = await exportHandler(req, { params: { id: testConversationId } })

        if (i < 5) {
          // 前 5 次应该成功
          expect(response.status).toBe(200)
          expect(response.headers.get('X-RateLimit-Remaining')).toBe(String(4 - i))
        } else {
          // 第 6 次应该被限制
          expect(response.status).toBe(429)
          const data = await response.json()
          expect(data.error).toContain('操作过于频繁')
          expect(response.headers.get('Retry-After')).toBeDefined()
        }
      }
    })

    it('应该包含速率限制响应头', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      const req = new NextRequest(
        `http://localhost:3000/api/conversations/${testConversationId}/export`
      )

      const response = await exportHandler(req, { params: { id: testConversationId } })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })
  })

  describe('POST /api/conversations/export-batch - 批量导出', () => {
    let secondConversationId: string

    beforeAll(async () => {
      // 创建第二个测试对话
      const [conv] = await db.insert(conversations).values({
        id: 'test-conv-export-3',
        userId: testUserId,
        documentId: testDocumentId,
        title: '第二个测试对话'
      }).returning()
      secondConversationId = conv.id

      await db.insert(messages).values([
        {
          id: 'msg-3',
          conversationId: secondConversationId,
          role: 'USER',
          content: '第二个问题'
        },
        {
          id: 'msg-4',
          conversationId: secondConversationId,
          role: 'ASSISTANT',
          content: '第二个回答'
        }
      ])
    })

    afterAll(async () => {
      await db.delete(messages).where(eq(messages.conversationId, secondConversationId))
      await db.delete(conversations).where(eq(conversations.id, secondConversationId))
    })

    it('应该成功批量导出多个对话为 ZIP', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      const req = new NextRequest(
        'http://localhost:3000/api/conversations/export-batch',
        {
          method: 'POST',
          body: JSON.stringify({
            conversationIds: [testConversationId, secondConversationId],
            format: 'markdown'
          })
        }
      )

      const response = await batchExportHandler(req)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/zip')
      expect(response.headers.get('Content-Disposition')).toContain('.zip')

      // 验证 ZIP 内容（基本检查）
      const buffer = await response.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(0)
    })

    it('应该拒绝空的对话列表（400）', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      const req = new NextRequest(
        'http://localhost:3000/api/conversations/export-batch',
        {
          method: 'POST',
          body: JSON.stringify({
            conversationIds: [],
            format: 'markdown'
          })
        }
      )

      const response = await batchExportHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('请选择要导出的对话')
    })

    it('应该拒绝超过 50 个对话的批量导出（400）', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      // 创建 51 个对话 ID
      const tooManyIds = Array.from({ length: 51 }, (_, i) => `conv-${i}`)

      const req = new NextRequest(
        'http://localhost:3000/api/conversations/export-batch',
        {
          method: 'POST',
          body: JSON.stringify({
            conversationIds: tooManyIds,
            format: 'markdown'
          })
        }
      )

      const response = await batchExportHandler(req)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('一次最多导出50个对话')
    })

    it('应该在批量导出超过速率限制时返回 429', async () => {
      mockedAuth.mockResolvedValue({
        user: { id: testUserId, email: 'test-export@test.com' }
      } as any)

      // 批量导出限制是 2 次 / 5 分钟
      for (let i = 0; i < 3; i++) {
        const req = new NextRequest(
          'http://localhost:3000/api/conversations/export-batch',
          {
            method: 'POST',
            body: JSON.stringify({
              conversationIds: [testConversationId],
              format: 'markdown'
            })
          }
        )
        const response = await batchExportHandler(req)

        if (i < 2) {
          // 前 2 次应该成功
          expect(response.status).toBe(200)
        } else {
          // 第 3 次应该被限制
          expect(response.status).toBe(429)
          const data = await response.json()
          expect(data.error).toContain('批量导出操作过于频繁')
        }
      }
    })
  })
})

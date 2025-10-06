/**
 * Chat Query API 集成测试
 * Story 3.1: 问答界面与输入处理
 */

import { POST, GET } from '@/app/api/chat/query/route'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/lib/db')
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true })
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockDb = db as jest.Mocked<typeof db>

describe('POST /api/chat/query', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  }

  const mockDocument = {
    id: 'doc-123',
    userId: 'user-123',
    filename: 'test.pdf',
    fileType: 'pdf',
    status: 'READY',
    vectorized: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('认证检查', () => {
    it('未登录时应该返回401', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123', question: '测试问题' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('未授权，请先登录')
    })
  })

  describe('输入验证', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: mockUser, expires: '' })
    })

    it('缺少documentId时应该返回400', async () => {
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ question: '测试问题' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('缺少documentId参数')
    })

    it('缺少question时应该返回400', async () => {
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('问题不能为空')
    })

    it('空question时应该返回400', async () => {
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123', question: '   ' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('问题不能为空')
    })

    it('问题过长时应该返回400', async () => {
      const longQuestion = 'a'.repeat(1001)
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123', question: longQuestion })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('问题过长')
    })
  })

  describe('文档验证', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: mockUser, expires: '' })
    })

    it('文档不存在时应该返回404', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any)

      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'non-existent', question: '测试问题' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('文档不存在或无权访问')
    })

    it('文档未就绪时应该返回400', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { ...mockDocument, status: 'PROCESSING' }
            ])
          })
        })
      } as any)

      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123', question: '测试问题' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('文档尚未处理完成')
    })

    it('文档未向量化时应该返回400', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { ...mockDocument, vectorized: false }
            ])
          })
        })
      } as any)

      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-123', question: '测试问题' })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('文档尚未向量化，无法进行问答')
    })
  })

  describe('成功场景', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: mockUser, expires: '' })
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockDocument])
          })
        })
      } as any)
    })

    it('有效请求应该返回成功响应', async () => {
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ 
          documentId: 'doc-123', 
          question: '测试问题',
          conversationId: 'conv-123'
        })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.documentId).toBe('doc-123')
      expect(data.data.question).toBe('测试问题')
      expect(data.data.conversationId).toBe('conv-123')
    })

    it('应该去除问题首尾空格', async () => {
      const request = new Request('http://localhost/api/chat/query', {
        method: 'POST',
        body: JSON.stringify({ 
          documentId: 'doc-123', 
          question: '  测试问题  '
        })
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(data.data.question).toBe('测试问题')
    })
  })

  describe('GET请求', () => {
    it('不应该支持GET请求', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.error).toBe('不支持GET请求，请使用POST')
    })
  })
})

// @ts-nocheck - 测试文件跳过严格类型检查
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// Mock modules BEFORE importing route handler
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

jest.mock('@/drizzle/schema', () => ({
  documents: {},
  userUsage: {
    userId: 'userId',
    documentCount: 'documentCount',
    storageUsed: 'storageUsed',
  },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  sql: jest.fn((strings, ...values) => {
    return { sql: strings.join('?'), values }
  }),
}))

jest.mock('@/lib/file-validator', () => ({
  validateFileType: jest.fn(),
  validateFileSize: jest.fn(),
  sanitizeFilename: jest.fn(),
  validateFileExtension: jest.fn(),
}))

// NOW import after all mocks
import { POST } from '@/app/api/documents/upload/route'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  validateFileType,
  validateFileSize,
  sanitizeFilename,
  validateFileExtension,
} from '@/lib/file-validator'

describe('POST /api/documents/upload - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('AC3: 文件格式验证', () => {
    it('应该接受有效的PDF文件', async () => {
      // Mock 认证
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      // Mock 验证函数
      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true, detectedType: 'application/pdf' })
      sanitizeFilename.mockReturnValue('test.pdf')

      // Mock 数据库 - 用户使用量
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      // Mock 文档插入
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: 'doc123',
            filename: 'test.pdf',
            status: 'PENDING',
          },
        ]),
      }
      db.insert.mockReturnValue(mockInsert)

      // Mock 使用量更新
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ documentCount: 11 }]),
      }
      db.update.mockReturnValue(mockUpdate)

      // 创建请求
      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.documents).toHaveLength(1)
      expect(data.documents[0].filename).toBe('test.pdf')
    })

    it('应该拒绝超过50MB的文件', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({
        valid: false,
        error: '文件大小超过限制(50MB)',
      })

      const file = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('文件大小超过限制')
    })

    it('应该拒绝不支持的文件格式', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })

      const file = new File(['content'], 'test.exe', {
        type: 'application/x-msdownload',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('不支持的文件格式')
    })

    it('应该检测MIME类型伪造 (SEC-001)', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({
        valid: false,
        error: '文件类型不匹配。声明: text/plain, 实际: application/pdf',
        detectedType: 'application/pdf',
      })

      const file = new File(['%PDF-1.4'], 'fake.txt', {
        type: 'text/plain',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('类型不匹配')
    })
  })

  describe('AC7: 用户配额检查', () => {
    it('应该拒绝超出文档数量限制的上传', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true })
      sanitizeFilename.mockReturnValue('test.pdf')

      // Mock 用户已达到配额
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 50, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('文档数量已达上限')
      expect(data.details.limit).toBe(50)
    })

    it('应该拒绝超出存储空间限制的上传', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true })
      sanitizeFilename.mockReturnValue('test.pdf')

      // Mock 用户存储空间已满
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 500 * 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      const file = new File(['x'.repeat(1024 * 1024)], 'test.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 })

      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('存储空间不足')
    })

    it('应该使用原子操作防止配额竞态条件 (DATA-001)', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true })
      sanitizeFilename.mockReturnValue('test.pdf')

      // Mock 数据库查询
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          { id: 'doc123', filename: 'test.pdf', status: 'PENDING' },
        ]),
      }
      db.insert.mockReturnValue(mockInsert)

      // Mock 原子更新失败（竞态条件）
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]), // 空数组表示更新失败
      }
      db.update.mockReturnValue(mockUpdate)

      // Mock 删除操作（回滚）
      const mockDelete = {
        where: jest.fn().mockResolvedValue([]),
      }
      db.delete.mockReturnValue(mockDelete)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('配额检查失败')
      expect(db.delete).toHaveBeenCalled() // 验证回滚操作
    })
  })

  describe('认证和授权', () => {
    it('应该拒绝未认证的请求', async () => {
      auth.mockResolvedValue(null)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('未授权')
    })
  })

  describe('文件名清理 (SEC-001)', () => {
    it('应该清理恶意文件名', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true })
      sanitizeFilename.mockReturnValue('safe-file.pdf') // 模拟清理后的文件名

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          { id: 'doc123', filename: 'safe-file.pdf', status: 'PENDING' },
        ]),
      }
      db.insert.mockReturnValue(mockInsert)

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ documentCount: 11 }]),
      }
      db.update.mockReturnValue(mockUpdate)

      const file = new File(['content'], '../../../etc/passwd', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(sanitizeFilename).toHaveBeenCalledWith('../../../etc/passwd')
      expect(data.documents[0].filename).toBe('safe-file.pdf')
    })
  })

  describe('错误处理', () => {
    it('应该处理缺少文件的请求', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      const formData = new FormData()
      // 没有添加文件

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('未找到文件')
    })

    it('应该处理数据库错误', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({ valid: true })
      sanitizeFilename.mockReturnValue('test.pdf')

      // Mock 数据库错误
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockRejectedValue(new Error('Database error')),
      }
      db.select.mockReturnValue(mockSelect)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('数据库操作失败')
    })
  })

  describe('创建文档记录', () => {
    it('应该创建PENDING状态的文档记录', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({
        valid: true,
        detectedType: 'application/pdf',
      })
      sanitizeFilename.mockReturnValue('test.pdf')

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      let insertedValues
      const mockInsert = {
        values: jest.fn((values) => {
          insertedValues = values
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: values.id,
                filename: values.filename,
                status: values.status,
              },
            ]),
          }
        }),
      }
      db.insert.mockReturnValue(mockInsert)

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ documentCount: 11 }]),
      }
      db.update.mockReturnValue(mockUpdate)

      const file = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      await POST(request)

      expect(insertedValues.status).toBe('PENDING')
      expect(insertedValues.filename).toBe('test.pdf')
      expect(insertedValues.userId).toBe('user123')
      expect(insertedValues.fileType).toBe('application/pdf')
    })

    it('应该在元数据中记录验证信息', async () => {
      auth.mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
      })

      validateFileSize.mockReturnValue({ valid: true })
      validateFileExtension.mockReturnValue({ valid: true })
      validateFileType.mockResolvedValue({
        valid: true,
        detectedType: 'application/pdf',
      })
      sanitizeFilename.mockReturnValue('test.pdf')

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          { documentCount: 10, storageUsed: 1024 * 1024 },
        ]),
      }
      db.select.mockReturnValue(mockSelect)

      let insertedValues
      const mockInsert = {
        values: jest.fn((values) => {
          insertedValues = values
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: values.id,
                filename: values.filename,
                status: values.status,
              },
            ]),
          }
        }),
      }
      db.insert.mockReturnValue(mockInsert)

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ documentCount: 11 }]),
      }
      db.update.mockReturnValue(mockUpdate)

      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      const formData = new FormData()
      formData.append('file', file)

      const request = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: { 'user-agent': 'Test Browser' },
      })

      await POST(request)

      expect(insertedValues.metadata).toBeDefined()
      expect(insertedValues.metadata.validatedType).toBe('application/pdf')
      expect(insertedValues.metadata.originalFilename).toBe('test.pdf')
    })
  })
})


/**
 * Document Upload with Storage - 集成测试
 * 
 * 测试范围:
 * - 完整上传流程: 文件验证→Storage上传→数据库记录→配额更新
 * - Storage上传失败的回滚机制
 * - 配额超出时的拒绝逻辑
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { POST } from '@/app/api/documents/upload/route'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, userUsage } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { StorageService } from '@/services/documents/storageService'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/services/documents/storageService')

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockStorageService = StorageService as jest.Mocked<typeof StorageService>

describe('POST /api/documents/upload (with Storage)', () => {
  const mockSession = {
    user: {
      id: 'test-user-123',
      email: 'test@example.com'
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    // 清理测试数据
    await db.delete(documents).where(eq(documents.userId, mockSession.user.id))
    await db.delete(userUsage).where(eq(userUsage.userId, mockSession.user.id))

    // 初始化用户配额
    await db.insert(userUsage).values({
      userId: mockSession.user.id,
      documentCount: 0,
      storageUsed: 0,
      queryCount: 0,
      queryResetDate: new Date()
    })

    // Mock auth session
    mockAuth.mockResolvedValue(mockSession as any)
  })

  it('should upload file to Storage and create database record', async () => {
    // 创建测试文件
    const testContent = 'Test file content for integration test'
    const testFile = new File([testContent], 'test-doc.txt', {
      type: 'text/plain'
    })

    const formData = new FormData()
    formData.append('file', testFile)

    // Mock Storage上传成功
    const mockStoragePath = `${mockSession.user.id}/doc123_test-doc.txt`
    mockStorageService.uploadFile.mockResolvedValue(mockStoragePath)

    // 创建请求
    const req = new NextRequest('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData
    })

    // 调用API
    const res = await POST(req)
    const data = await res.json()

    // 断言响应
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.documents).toHaveLength(1)
    expect(data.documents[0]).toMatchObject({
      filename: 'test-doc.txt',
      status: 'PENDING'
    })

    // 验证Storage被调用
    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
      mockSession.user.id,
      expect.any(String),
      expect.any(File),
      'test-doc.txt'
    )

    // 验证数据库记录
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.userId, mockSession.user.id))

    expect(document).toBeDefined()
    expect(document.filename).toBe('test-doc.txt')
    expect(document.storagePath).toBe(mockStoragePath)
    expect(document.status).toBe('PENDING')

    // 验证配额更新
    const [usage] = await db.select()
      .from(userUsage)
      .where(eq(userUsage.userId, mockSession.user.id))

    expect(usage.documentCount).toBe(1)
    expect(usage.storageUsed).toBe(testContent.length)
  })

  it('should rollback on Storage upload failure', async () => {
    const testFile = new File(['test content'], 'test-doc.txt', {
      type: 'text/plain'
    })

    const formData = new FormData()
    formData.append('file', testFile)

    // Mock Storage上传失败
    mockStorageService.uploadFile.mockRejectedValue(
      new Error('Storage upload failed')
    )
    mockStorageService.deleteFile.mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData
    })

    const res = await POST(req)
    const data = await res.json()

    // 断言错误响应
    expect(res.status).toBe(500)
    expect(data.error).toBe('文件上传失败')

    // 验证数据库记录未创建
    const docs = await db.select()
      .from(documents)
      .where(eq(documents.userId, mockSession.user.id))

    expect(docs).toHaveLength(0)

    // 验证配额未更新
    const [usage] = await db.select()
      .from(userUsage)
      .where(eq(userUsage.userId, mockSession.user.id))

    expect(usage.documentCount).toBe(0)
    expect(usage.storageUsed).toBe(0)
  })

  it('should reject upload when quota exceeded', async () => {
    // 设置已接近配额上限
    await db.update(userUsage)
      .set({
        documentCount: 50, // 已达上限
        storageUsed: 0
      })
      .where(eq(userUsage.userId, mockSession.user.id))

    const testFile = new File(['test'], 'test.txt', {
      type: 'text/plain'
    })

    const formData = new FormData()
    formData.append('file', testFile)

    const req = new NextRequest('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData
    })

    const res = await POST(req)
    const data = await res.json()

    // 断言配额错误
    expect(res.status).toBe(400)
    expect(data.error).toContain('文档数量已达上限')

    // 验证Storage未被调用
    expect(mockStorageService.uploadFile).not.toHaveBeenCalled()
  })

  it('should reject when storage space exceeded', async () => {
    // 设置存储空间接近上限
    const maxStorage = 500 * 1024 * 1024 // 500MB
    await db.update(userUsage)
      .set({
        documentCount: 0,
        storageUsed: maxStorage - 1000 // 只剩1KB
      })
      .where(eq(userUsage.userId, mockSession.user.id))

    // 尝试上传2KB文件
    const largeContent = 'a'.repeat(2000)
    const testFile = new File([largeContent], 'large.txt', {
      type: 'text/plain'
    })

    const formData = new FormData()
    formData.append('file', testFile)

    const req = new NextRequest('http://localhost/api/documents/upload', {
      method: 'POST',
      body: formData
    })

    const res = await POST(req)
    const data = await res.json()

    // 断言存储空间错误
    expect(res.status).toBe(400)
    expect(data.error).toBe('存储空间不足')

    // 验证Storage未被调用
    expect(mockStorageService.uploadFile).not.toHaveBeenCalled()
  })

  it('should handle concurrent uploads correctly', async () => {
    // 并发上传3个文件
    const uploads = Array.from({ length: 3 }, (_, i) => {
      const testFile = new File([`content ${i}`], `test-${i}.txt`, {
        type: 'text/plain'
      })

      const formData = new FormData()
      formData.append('file', testFile)

      // Mock每个文件的Storage上传
      mockStorageService.uploadFile.mockResolvedValueOnce(
        `${mockSession.user.id}/doc${i}_test-${i}.txt`
      )

      const req = new NextRequest('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      return POST(req)
    })

    const results = await Promise.all(uploads)

    // 验证所有上传都成功
    results.forEach(res => {
      expect(res.status).toBe(200)
    })

    // 验证数据库有3个文档
    const docs = await db.select()
      .from(documents)
      .where(eq(documents.userId, mockSession.user.id))

    expect(docs).toHaveLength(3)

    // 验证配额正确累计
    const [usage] = await db.select()
      .from(userUsage)
      .where(eq(userUsage.userId, mockSession.user.id))

    expect(usage.documentCount).toBe(3)
  })
})


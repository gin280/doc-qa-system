/**
 * Storage Service单元测试
 * 
 * 测试范围:
 * - uploadFile: 文件上传和重试机制
 * - getFile: 文件下载
 * - getSignedUrl: 生成签名URL
 * - deleteFile: 文件删除
 * - fileExists: 文件存在性检查
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock Supabase with factory function BEFORE any imports
const mockFrom = jest.fn()

jest.mock('@/lib/supabase', () => {
  return {
    supabase: {
      storage: {
        from: mockFrom
      }
    },
    supabaseAdmin: {
      storage: {
        from: mockFrom
      }
    },
    getSupabaseWithAuth: jest.fn()
  }
})

// Now safe to import
import { StorageService } from '@/services/documents/storageService'

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('uploadFile', () => {
    it('should upload file to Supabase Storage', async () => {
      const userId = 'user123'
      const documentId = 'doc456'
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const sanitizedFilename = 'test.txt'

      // 实际路径格式: userId/documentId.ext (不包含完整文件名)
      const expectedPath = `${userId}/${documentId}.txt`

      // Mock successful upload
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: expectedPath },
        error: null
      })

      mockFrom.mockReturnValue({
        upload: mockUpload
      })

      const path = await StorageService.uploadFile(
        userId,
        documentId,
        file,
        sanitizedFilename
      )

      expect(path).toBe(expectedPath)
      expect(mockUpload).toHaveBeenCalledWith(
        expectedPath,
        file,
        expect.objectContaining({
          cacheControl: '3600',
          upsert: false,
          contentType: 'text/plain'
        })
      )
    })

    it('should retry on failure and succeed', async () => {
      const userId = 'user123'
      const documentId = 'doc456'
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const sanitizedFilename = 'test.txt'
      const expectedPath = `${userId}/${documentId}.txt`

      // Mock: 第1次失败, 第2次成功
      const mockUpload = jest.fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Network error' }
        })
        .mockResolvedValueOnce({
          data: { path: expectedPath },
          error: null
        })

      mockFrom.mockReturnValue({
        upload: mockUpload
      })

      const path = await StorageService.uploadFile(
        userId,
        documentId,
        file,
        sanitizedFilename
      )

      expect(path).toBe(expectedPath)
      expect(mockUpload).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const userId = 'user123'
      const documentId = 'doc456'
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const sanitizedFilename = 'test.txt'

      // Mock: 所有3次都失败
      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Persistent error' }
      })

      mockFrom.mockReturnValue({
        upload: mockUpload
      })

      await expect(
        StorageService.uploadFile(userId, documentId, file, sanitizedFilename)
      ).rejects.toThrow('Failed to upload file after 3 attempts')

      expect(mockUpload).toHaveBeenCalledTimes(3)
    })
  })

  describe('getFile', () => {
    it('should download file from Storage', async () => {
      const storagePath = 'user123/doc456.txt'
      const mockBuffer = new ArrayBuffer(100)

      const mockDownload = jest.fn().mockResolvedValue({
        data: {
          arrayBuffer: jest.fn().mockResolvedValue(mockBuffer)
        },
        error: null
      })

      mockFrom.mockReturnValue({
        download: mockDownload
      })

      const buffer = await StorageService.getFile(storagePath)

      expect(buffer).toBe(mockBuffer)
      expect(mockDownload).toHaveBeenCalledWith(storagePath)
    })

    it('should throw error if download fails', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockDownload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'File not found' }
      })

      mockFrom.mockReturnValue({
        download: mockDownload
      })

      await expect(
        StorageService.getFile(storagePath)
      ).rejects.toThrow('Failed to download file')
    })
  })

  describe('getSignedUrl', () => {
    it('should generate signed URL with expiration', async () => {
      const storagePath = 'user123/doc456.txt'
      const expectedUrl = 'https://supabase.co/storage/v1/object/sign/documents/user123/doc456.txt?token=abc123'

      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null
      })

      mockFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl
      })

      const url = await StorageService.getSignedUrl(storagePath, 3600)

      expect(url).toBe(expectedUrl)
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(storagePath, 3600)
    })

    it('should use default expiration of 1 hour', async () => {
      const storagePath = 'user123/doc456.txt'
      const expectedUrl = 'https://supabase.co/storage/signed/test'

      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: expectedUrl },
        error: null
      })

      mockFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl
      })

      await StorageService.getSignedUrl(storagePath)

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(storagePath, 3600)
    })
  })

  describe('deleteFile', () => {
    it('should delete file from Storage', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })

      mockFrom.mockReturnValue({
        remove: mockRemove
      })

      await expect(
        StorageService.deleteFile(storagePath)
      ).resolves.not.toThrow()

      expect(mockRemove).toHaveBeenCalledWith([storagePath])
    })

    it('should throw error if deletion fails', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'File not found' }
      })

      mockFrom.mockReturnValue({
        remove: mockRemove
      })

      await expect(
        StorageService.deleteFile(storagePath)
      ).rejects.toThrow('Failed to delete file')
    })
  })

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockList = jest.fn().mockResolvedValue({
        data: [
          { name: 'doc456.txt' },
          { name: 'other.txt' }
        ],
        error: null
      })

      mockFrom.mockReturnValue({
        list: mockList
      })

      const exists = await StorageService.fileExists(storagePath)

      expect(exists).toBe(true)
      expect(mockList).toHaveBeenCalledWith('user123')
    })

    it('should return false if file does not exist', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockList = jest.fn().mockResolvedValue({
        data: [
          { name: 'other.txt' }
        ],
        error: null
      })

      mockFrom.mockReturnValue({
        list: mockList
      })

      const exists = await StorageService.fileExists(storagePath)

      expect(exists).toBe(false)
    })

    it('should return false if list fails', async () => {
      const storagePath = 'user123/doc456.txt'

      const mockList = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Permission denied' }
      })

      mockFrom.mockReturnValue({
        list: mockList
      })

      const exists = await StorageService.fileExists(storagePath)

      expect(exists).toBe(false)
    })
  })
})


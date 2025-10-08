/**
 * User Settings API 单元测试
 * 测试用户配置相关的 API 端点
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import * as authModule from '@/lib/auth'
import * as dbModule from '@/lib/db'
import bcrypt from 'bcrypt'

// Mock NextAuth
jest.mock('@/lib/auth')
jest.mock('@/lib/db')
jest.mock('bcrypt')

const mockAuth = authModule.auth as jest.MockedFunction<typeof authModule.auth>
const mockDb = dbModule.db as any

describe('User Settings API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/user/profile', () => {
    it('应该返回用户信息', async () => {
      // Mock session
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      // Mock database query
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        authProvider: 'EMAIL',
        createdAt: new Date(),
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser])
          })
        })
      })

      // 动态导入 route handler
      const { GET } = await import('@/app/api/user/profile/route')
      const request = new NextRequest('http://localhost/api/user/profile')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.email).toBe('test@example.com')
      expect(data.name).toBe('Test User')
    })

    it('应该在未登录时返回 401', async () => {
      mockAuth.mockResolvedValue(null)

      const { GET } = await import('@/app/api/user/profile/route')
      const request = new NextRequest('http://localhost/api/user/profile')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe('PATCH /api/user/profile', () => {
    it('应该成功更新用户名', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        avatarUrl: null,
        authProvider: 'EMAIL',
        createdAt: new Date(),
      }

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedUser])
          })
        })
      })

      const { PATCH } = await import('@/app/api/user/profile/route')
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name' })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('Updated Name')
    })

    it('应该拒绝过短的用户名', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const { PATCH } = await import('@/app/api/user/profile/route')
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'A' })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('至少2个字符')
    })

    it('应该拒绝过长的用户名', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const longName = 'A'.repeat(51)
      const { PATCH } = await import('@/app/api/user/profile/route')
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: longName })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('最多50个字符')
    })
  })

  describe('PATCH /api/user/password', () => {
    it('应该成功修改密码', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser])
          })
        })
      })

      mockDb.update = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      ;(bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true as never)
      ;(bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValue('new-hashed-password' as never)

      const { PATCH } = await import('@/app/api/user/password/route')
      const request = new NextRequest('http://localhost/api/user/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123'
        })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('密码修改成功')
    })

    it('应该在当前密码错误时返回 401', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      }

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser])
          })
        })
      })

      ;(bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false as never)

      const { PATCH } = await import('@/app/api/user/password/route')
      const request = new NextRequest('http://localhost/api/user/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123'
        })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('当前密码错误')
    })

    it('应该拒绝弱密码', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const { PATCH } = await import('@/app/api/user/password/route')
      const request = new NextRequest('http://localhost/api/user/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'weak',
          confirmPassword: 'weak'
        })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('至少8位')
    })

    it('应该在密码不匹配时返回错误', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const { PATCH } = await import('@/app/api/user/password/route')
      const request = new NextRequest('http://localhost/api/user/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
          confirmPassword: 'different123'
        })
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('两次密码输入不一致')
    })
  })

  describe('GET /api/user/usage', () => {
    it('应该返回用户使用量统计', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const mockUser = { id: 'user-123' }
      const mockUsage = {
        id: 'usage-123',
        userId: 'user-123',
        documentCount: 10,
        storageUsed: 1024 * 1024 * 100, // 100MB
        queryCount: 50,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockUser])
            })
          })
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockUsage])
            })
          })
        })

      const { GET } = await import('@/app/api/user/usage/route')
      const request = new NextRequest('http://localhost/api/user/usage')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documentCount).toBe(10)
      expect(data.queryCount).toBe(50)
      expect(data.documentLimit).toBe(50)
      expect(data.storageLimit).toBe(1 * 1024 * 1024 * 1024)
    })

    it('应该在用户无使用记录时返回初始值', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const mockUser = { id: 'user-123' }

      mockDb.select = jest.fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockUser])
            })
          })
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })

      const { GET } = await import('@/app/api/user/usage/route')
      const request = new NextRequest('http://localhost/api/user/usage')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.documentCount).toBe(0)
      expect(data.storageUsed).toBe(0)
      expect(data.queryCount).toBe(0)
    })
  })

  describe('DELETE /api/user/account', () => {
    it('应该成功删除账户', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      mockDb.delete = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined)
      })

      const { DELETE } = await import('@/app/api/user/account/route')
      const request = new NextRequest('http://localhost/api/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ email: 'test@example.com' })
      })
      const response = await DELETE(request)

      expect(response.status).toBe(204)
    })

    it('应该在邮箱不匹配时返回 400', async () => {
      mockAuth.mockResolvedValue({
        user: { email: 'test@example.com' }
      } as any)

      const { DELETE } = await import('@/app/api/user/account/route')
      const request = new NextRequest('http://localhost/api/user/account', {
        method: 'DELETE',
        body: JSON.stringify({ email: 'wrong@example.com' })
      })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('邮箱不匹配')
    })
  })
})


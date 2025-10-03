// @ts-nocheck - 暂时跳过测试文件的类型检查
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// IMPORTANT: Mock modules BEFORE importing the route handler
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}))

jest.mock('@/drizzle/schema', () => ({
  users: {},
  userUsage: {},
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}))

// NOW import the route handler after all mocks are set up
import { POST } from '@/app/api/auth/register/route'
import { db } from '@/lib/db'
import bcrypt from 'bcrypt'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该成功注册新用户', async () => {
    // Mock 数据库查询 - 邮箱不存在
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([] as any), // 空数组表示邮箱不存在
    }
    db.select = jest.fn().mockReturnValue(mockSelect) as any

    // Mock bcrypt hash
    bcrypt.hash = jest.fn().mockResolvedValue('hashed_password_123') as any

    // Mock 事务 - 现在使用事务包装用户创建
    const mockTx = {
      insert: jest.fn().mockImplementation(() => {
        return {
          values: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([
            {
              id: 'user_123',
              email: 'new@example.com',
              name: 'Test User',
              passwordHash: 'hashed_password_123',
              authProvider: 'EMAIL',
            },
          ]),
        }
      }),
    }

    db.transaction = jest.fn().mockImplementation(async (callback) => {
      return await callback(mockTx)
    }) as any

    // 创建请求对象
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    })

    // 调用 API
    const response = await POST(req as any)
    const data = await response.json()

    // 断言
    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.user).toEqual({
      id: 'user_123',
      email: 'new@example.com',
      name: 'Test User',
    })
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
  })

  it('应该拒绝已存在的邮箱', async () => {
    // Mock 数据库查询 - 邮箱已存在
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([
        {
          id: 'existing_user',
          email: 'existing@example.com',
        },
      ] as any),
    }
    db.select = jest.fn().mockReturnValue(mockSelect) as any

    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('该邮箱已被注册')
  })

  it('应该拒绝无效的邮箱格式', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
      }),
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('输入验证失败')
  })

  it('应该拒绝弱密码', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: '12345', // 少于8位
        name: 'Test User',
      }),
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('输入验证失败')
  })

  it('应该拒绝只包含字母或数字的密码', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'abcdefgh', // 只包含字母
        name: 'Test User',
      }),
    })

    const response = await POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('输入验证失败')
  })
})


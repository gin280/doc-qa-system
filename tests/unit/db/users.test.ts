// tests/unit/db/users.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { db } from '../../../src/lib/db'
import { users } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'

describe('User CRUD Operations', () => {
  let testUserId: string

  beforeEach(async () => {
    // 清理测试数据
    await db.delete(users).where(eq(users.email, 'test@example.com'))
  })

  afterAll(async () => {
    // 最终清理
    await db.delete(users).where(eq(users.email, 'test@example.com'))
  })

  it('should create a user', async () => {
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
    }).returning()
    
    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
    expect(user.id).toBeDefined()
    expect(user.authProvider).toBe('EMAIL')
    
    testUserId = user.id
  })

  it('should query a user by email', async () => {
    // 先创建用户
    await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
    })

    // 查询用户
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, 'test@example.com'))
    
    expect(user).toBeDefined()
    expect(user.email).toBe('test@example.com')
  })

  it('should update a user', async () => {
    // 先创建用户
    const [created] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
    }).returning()

    // 更新用户
    const [updated] = await db.update(users)
      .set({ name: 'Updated Name' })
      .where(eq(users.id, created.id))
      .returning()
    
    expect(updated.name).toBe('Updated Name')
    expect(updated.email).toBe('test@example.com')
  })

  it('should delete a user', async () => {
    // 先创建用户
    const [created] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
    }).returning()

    // 删除用户
    await db.delete(users).where(eq(users.id, created.id))

    // 验证已删除
    const [found] = await db.select()
      .from(users)
      .where(eq(users.id, created.id))
    
    expect(found).toBeUndefined()
  })

  it('should enforce unique email constraint', async () => {
    // 创建第一个用户
    await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User 1',
    })

    // 尝试创建相同email的用户应该失败
    await expect(
      db.insert(users).values({
        email: 'test@example.com',
        name: 'Test User 2',
      })
    ).rejects.toThrow()
  })
})


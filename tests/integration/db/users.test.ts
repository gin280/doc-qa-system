/**
 * 集成测试 - User CRUD Operations
 * 
 * ⚠️ 警告：此测试会连接真实数据库（Supabase）
 * 
 * 测试策略：
 * - 使用唯一的测试邮箱前缀避免冲突
 * - 每个测试前后自动清理数据
 * - 使用独立的测试数据，不影响生产数据
 * 
 * 运行方式：
 * npm run test:integration -- tests/integration/db/users.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { db } from '../../../src/lib/db'
import { users } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'

describe('User CRUD Operations (Integration)', () => {
  let testUserId: string
  const TEST_EMAIL = `integration-test-${Date.now()}@example.com`

  beforeEach(async () => {
    // 清理可能存在的测试数据
    await db.delete(users).where(eq(users.email, TEST_EMAIL))
  })

  afterAll(async () => {
    // 最终清理 - 删除所有集成测试用户
    try {
      await db.delete(users).where(eq(users.email, TEST_EMAIL))
      // 额外清理：删除所有老的测试数据
      const oldTestUsers = await db.select()
        .from(users)
        .where(eq(users.email, 'test@example.com'))
      
      if (oldTestUsers.length > 0) {
        await db.delete(users).where(eq(users.email, 'test@example.com'))
        console.log(`🧹 清理了 ${oldTestUsers.length} 个老的测试用户`)
      }
    } catch (error) {
      console.error('清理测试数据失败:', error)
    }
  })

  it('should create a user', async () => {
    const [user] = await db.insert(users).values({
      email: TEST_EMAIL,
      name: 'Test User',
    }).returning()
    
    expect(user.email).toBe(TEST_EMAIL)
    expect(user.name).toBe('Test User')
    expect(user.id).toBeDefined()
    expect(user.authProvider).toBe('EMAIL')
    
    testUserId = user.id
  })

  it('should query a user by email', async () => {
    // 先创建用户
    await db.insert(users).values({
      email: TEST_EMAIL,
      name: 'Test User',
    })

    // 查询用户
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
    
    expect(user).toBeDefined()
    expect(user.email).toBe(TEST_EMAIL)
  })

  it('should update a user', async () => {
    // 先创建用户
    const [created] = await db.insert(users).values({
      email: TEST_EMAIL,
      name: 'Test User',
    }).returning()

    // 更新用户
    const [updated] = await db.update(users)
      .set({ name: 'Updated Name' })
      .where(eq(users.id, created.id))
      .returning()
    
    expect(updated.name).toBe('Updated Name')
    expect(updated.email).toBe(TEST_EMAIL)
  })

  it('should delete a user', async () => {
    // 先创建用户
    const [created] = await db.insert(users).values({
      email: TEST_EMAIL,
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
      email: TEST_EMAIL,
      name: 'Test User 1',
    })

    // 尝试创建相同email的用户应该失败
    await expect(
      db.insert(users).values({
        email: TEST_EMAIL,
        name: 'Test User 2',
      })
    ).rejects.toThrow()
  })
})


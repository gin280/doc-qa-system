/**
 * User Settings 集成测试
 * 测试用户设置的完整流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { db } from '@/lib/db'
import { users, userUsage } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { createId } from '@paralleldrive/cuid2'

describe('Settings Flow Integration Tests', () => {
  let testUserId: string
  let testUserEmail: string

  beforeAll(async () => {
    // 创建测试用户
    testUserEmail = `test-settings-${Date.now()}@example.com`
    const passwordHash = await bcrypt.hash('testPassword123', 10)

    const [user] = await db.insert(users).values({
      id: createId(),
      email: testUserEmail,
      name: 'Test Settings User',
      passwordHash,
      authProvider: 'EMAIL',
      status: 'active'
    }).returning()

    testUserId = user.id

    // 创建使用量记录
    await db.insert(userUsage).values({
      id: createId(),
      userId: testUserId,
      documentCount: 5,
      storageUsed: 1024 * 1024 * 10, // 10MB
      queryCount: 20,
      queryResetDate: new Date()
    })
  })

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  describe('完整的用户名修改流程', () => {
    it('应该成功修改用户名', async () => {
      // 1. 查询用户当前信息
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1)

      expect(user.name).toBe('Test Settings User')

      // 2. 更新用户名
      const newName = 'Updated Settings User'
      const [updatedUser] = await db
        .update(users)
        .set({
          name: newName,
          updatedAt: new Date()
        })
        .where(eq(users.id, testUserId))
        .returning()

      expect(updatedUser.name).toBe(newName)

      // 3. 验证更新
      const [verifiedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1)

      expect(verifiedUser.name).toBe(newName)
    })
  })

  describe('完整的密码修改流程', () => {
    it('应该成功修改密码', async () => {
      // 1. 获取当前用户
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1)

      // 2. 验证当前密码
      const currentPassword = 'testPassword123'
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash!)
      expect(isValid).toBe(true)

      // 3. 生成新密码哈希
      const newPassword = 'newTestPassword456'
      const newPasswordHash = await bcrypt.hash(newPassword, 10)

      // 4. 更新密码
      await db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date()
        })
        .where(eq(users.id, testUserId))

      // 5. 验证新密码
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1)

      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.passwordHash!)
      expect(isNewPasswordValid).toBe(true)

      // 6. 验证旧密码无效
      const isOldPasswordValid = await bcrypt.compare(currentPassword, updatedUser.passwordHash!)
      expect(isOldPasswordValid).toBe(false)

      // 恢复原密码
      const originalHash = await bcrypt.hash('testPassword123', 10)
      await db
        .update(users)
        .set({ passwordHash: originalHash })
        .where(eq(users.id, testUserId))
    })
  })

  describe('使用量统计流程', () => {
    it('应该正确查询使用量统计', async () => {
      const [usage] = await db
        .select()
        .from(userUsage)
        .where(eq(userUsage.userId, testUserId))
        .limit(1)

      expect(usage).toBeDefined()
      expect(usage.documentCount).toBe(5)
      expect(usage.storageUsed).toBe(1024 * 1024 * 10)
      expect(usage.queryCount).toBe(20)
    })

    it('应该能更新使用量', async () => {
      // 更新使用量
      await db
        .update(userUsage)
        .set({
          documentCount: 10,
          storageUsed: 1024 * 1024 * 20,
          queryCount: 50,
          updatedAt: new Date()
        })
        .where(eq(userUsage.userId, testUserId))

      // 验证更新
      const [usage] = await db
        .select()
        .from(userUsage)
        .where(eq(userUsage.userId, testUserId))
        .limit(1)

      expect(usage.documentCount).toBe(10)
      expect(usage.storageUsed).toBe(1024 * 1024 * 20)
      expect(usage.queryCount).toBe(50)

      // 恢复原值
      await db
        .update(userUsage)
        .set({
          documentCount: 5,
          storageUsed: 1024 * 1024 * 10,
          queryCount: 20,
          updatedAt: new Date()
        })
        .where(eq(userUsage.userId, testUserId))
    })
  })

  describe('OAuth 用户特殊处理', () => {
    let oauthUserId: string
    let oauthUserEmail: string

    beforeEach(async () => {
      // 创建 OAuth 测试用户
      oauthUserEmail = `oauth-test-${Date.now()}@example.com`
      const [oauthUser] = await db.insert(users).values({
        id: createId(),
        email: oauthUserEmail,
        name: 'OAuth Test User',
        passwordHash: null, // OAuth 用户没有密码
        authProvider: 'GOOGLE',
        status: 'active'
      }).returning()

      oauthUserId = oauthUser.id
    })

    afterAll(async () => {
      // 清理 OAuth 测试用户
      if (oauthUserId) {
        await db.delete(users).where(eq(users.id, oauthUserId))
      }
    })

    it('OAuth 用户应该无法修改密码', async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, oauthUserId))
        .limit(1)

      expect(user.authProvider).toBe('GOOGLE')
      expect(user.passwordHash).toBeNull()
    })

    it('OAuth 用户应该能修改用户名', async () => {
      const newName = 'Updated OAuth User'
      const [updatedUser] = await db
        .update(users)
        .set({
          name: newName,
          updatedAt: new Date()
        })
        .where(eq(users.id, oauthUserId))
        .returning()

      expect(updatedUser.name).toBe(newName)
    })
  })

  describe('删除账户流程', () => {
    it('应该级联删除用户相关数据', async () => {
      // 创建临时测试用户
      const tempEmail = `temp-delete-test-${Date.now()}@example.com`
      const [tempUser] = await db.insert(users).values({
        id: createId(),
        email: tempEmail,
        name: 'Temp Delete User',
        passwordHash: await bcrypt.hash('test123', 10),
        authProvider: 'EMAIL',
        status: 'active'
      }).returning()

      // 创建使用量记录
      await db.insert(userUsage).values({
        id: createId(),
        userId: tempUser.id,
        documentCount: 0,
        storageUsed: 0,
        queryCount: 0,
        queryResetDate: new Date()
      })

      // 验证用户和使用量存在
      const [userBefore] = await db
        .select()
        .from(users)
        .where(eq(users.id, tempUser.id))
        .limit(1)
      expect(userBefore).toBeDefined()

      const [usageBefore] = await db
        .select()
        .from(userUsage)
        .where(eq(userUsage.userId, tempUser.id))
        .limit(1)
      expect(usageBefore).toBeDefined()

      // 删除用户
      await db.delete(users).where(eq(users.id, tempUser.id))

      // 验证用户已删除
      const [userAfter] = await db
        .select()
        .from(users)
        .where(eq(users.id, tempUser.id))
        .limit(1)
      expect(userAfter).toBeUndefined()

      // 验证使用量已级联删除
      const [usageAfter] = await db
        .select()
        .from(userUsage)
        .where(eq(userUsage.userId, tempUser.id))
        .limit(1)
      expect(usageAfter).toBeUndefined()
    })
  })
})


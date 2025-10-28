/**
 * Usage Service - 使用量统计服务
 * Story 3.3: LLM回答生成与流式输出
 * 
 * 处理用户使用量的追踪和限额控制
 */

import { db } from '@/lib/db'
import { userUsage } from '@/drizzle/schema'
import { eq, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { logger } from '@/lib/logger'

/**
 * 使用量统计服务
 */
export class UsageService {
  /**
   * 增加用户查询次数
   * 
   * @param userId 用户ID
   */
  async incrementQueryCount(userId: string): Promise<void> {
    try {
      // 首先尝试查找用户的usage记录
      const [existingUsage] = await db
        .select()
        .from(userUsage)
        .where(eq(userUsage.userId, userId))
        .limit(1)

      if (existingUsage) {
        // 如果存在，更新查询次数
        await db
          .update(userUsage)
          .set({
            queryCount: sql`${userUsage.queryCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(userUsage.userId, userId))
      } else {
        // 如果不存在，创建新记录
        await db
          .insert(userUsage)
          .values({
            id: createId(),
            userId,
            documentCount: 0,
            storageUsed: 0,
            queryCount: 1,
            queryResetDate: new Date(),
            updatedAt: new Date()
          })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error({ 
        service: 'UsageService',
        userId,
        error: errorMessage,
        action: 'increment_query_error'
      }, 'Failed to increment query count')
      // 不抛出错误，统计失败不影响主流程
    }
  }

  /**
   * 获取用户使用统计
   * 
   * @param userId 用户ID
   * @returns 使用统计信息
   */
  async getUserUsage(userId: string) {
    let [usage] = await db
      .select()
      .from(userUsage)
      .where(eq(userUsage.userId, userId))
      .limit(1)

    // 如果用户usage记录不存在，创建一个
    if (!usage) {
      const [newUsage] = await db
        .insert(userUsage)
        .values({
          id: createId(),
          userId,
          documentCount: 0,
          storageUsed: 0,
          queryCount: 0,
          queryResetDate: new Date(),
          updatedAt: new Date()
        })
        .returning()
      
      usage = newUsage
    }

    return usage
  }

  /**
   * 检查用户是否超过限额
   * 
   * @param userId 用户ID
   * @param dailyLimit 日限额（默认100次）
   * @returns 是否允许查询 + 剩余次数
   */
  async checkQuotaLimit(userId: string, dailyLimit: number = 100): Promise<{
    allowed: boolean
    remaining: number
    resetDate: Date
  }> {
    const usage = await this.getUserUsage(userId)

    // 检查是否需要重置（简化实现：检查resetDate是否是今天）
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const resetDate = new Date(usage.queryResetDate)
    resetDate.setHours(0, 0, 0, 0)

    // 如果resetDate不是今天，重置计数
    if (resetDate.getTime() < today.getTime()) {
      await db
        .update(userUsage)
        .set({
          queryCount: 0,
          queryResetDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userUsage.userId, userId))

      return {
        allowed: true,
        remaining: dailyLimit,
        resetDate: new Date()
      }
    }

    // 计算剩余次数
    const remaining = Math.max(0, dailyLimit - usage.queryCount)
    const allowed = remaining > 0

    return {
      allowed,
      remaining,
      resetDate: usage.queryResetDate
    }
  }

  /**
   * 重置用户日查询限额（手动重置，管理员功能）
   * 
   * @param userId 用户ID
   */
  async resetDailyQuota(userId: string): Promise<void> {
    await db
      .update(userUsage)
      .set({
        queryCount: 0,
        queryResetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userUsage.userId, userId))
  }
}

// 导出单例
export const usageService = new UsageService()

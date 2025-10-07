/**
 * UsageService单元测试
 * Story 3.3: LLM回答生成与流式输出
 */

import { usageService } from '@/services/user/usageService'
import { db } from '@/lib/db'
import { userUsage } from '@/drizzle/schema'

// Mock数据库
jest.mock('@/lib/db', () => ({
  db: {
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn()
      }))
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn()
        }))
      }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn()
      }))
    }))
  }
}))

jest.mock('@/drizzle/schema', () => ({
  userUsage: {}
}))

describe('UsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('incrementQueryCount', () => {
    it('应该增加现有用户的查询次数', async () => {
      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        documentCount: 0,
        storageUsed: 0,
        queryCount: 5,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      await usageService.incrementQueryCount('user-1')

      expect(db.update).toHaveBeenCalled()
    })

    it('应该为新用户创建usage记录', async () => {
      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]) // 不存在
          })
        })
      })

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined)
      })

      await usageService.incrementQueryCount('user-1')

      expect(db.insert).toHaveBeenCalled()
    })

    it('应该处理错误而不抛出异常', async () => {
      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        })
      })

      // 不应该抛出错误
      await expect(usageService.incrementQueryCount('user-1')).resolves.not.toThrow()
    })
  })

  describe('getUserUsage', () => {
    it('应该获取用户使用统计', async () => {
      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        documentCount: 5,
        storageUsed: 1000000,
        queryCount: 10,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      const result = await usageService.getUserUsage('user-1')

      expect(result).toBeDefined()
      expect(result.userId).toBe('user-1')
      expect(result.queryCount).toBe(10)
    })

    it('应该为不存在的用户创建新记录', async () => {
      const mockNewUsage = {
        id: 'new-usage-id',
        userId: 'user-1',
        documentCount: 0,
        storageUsed: 0,
        queryCount: 0,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]) // 不存在
          })
        })
      })

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockNewUsage])
        })
      })

      const result = await usageService.getUserUsage('user-1')

      expect(result).toBeDefined()
      expect(result.queryCount).toBe(0)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('checkQuotaLimit', () => {
    it('应该允许未超限的查询', async () => {
      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        documentCount: 0,
        storageUsed: 0,
        queryCount: 50,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      const result = await usageService.checkQuotaLimit('user-1', 100)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
    })

    it('应该拒绝超限的查询', async () => {
      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        documentCount: 0,
        storageUsed: 0,
        queryCount: 100,
        queryResetDate: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      const result = await usageService.checkQuotaLimit('user-1', 100)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('应该在新的一天重置限额', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        documentCount: 0,
        storageUsed: 0,
        queryCount: 100,
        queryResetDate: yesterday,
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      const result = await usageService.checkQuotaLimit('user-1', 100)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(100)
      expect(db.update).toHaveBeenCalled()
    })
  })
})

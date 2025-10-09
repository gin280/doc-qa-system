/**
 * 高级速率限制器 - 支持不同的限流策略
 * 用于敏感操作如密码修改、账户删除等
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

// 清理过期的限流记录
setInterval(() => {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  })
}, 5 * 60 * 1000)

export interface RateLimiterOptions {
  interval: number // 时间窗口(毫秒)
  uniqueTokenPerInterval: number // 最大唯一token数(用于内存管理)
}

export interface RateLimiter {
  check: (identifier: string, limit: number) => Promise<void>
}

/**
 * 创建速率限制器
 */
export function rateLimit(options: RateLimiterOptions): RateLimiter {
  const { interval } = options

  return {
    async check(identifier: string, limit: number): Promise<void> {
      const now = Date.now()
      const record = store[identifier]

      // 如果没有记录或已过期,创建新记录
      if (!record || record.resetTime < now) {
        store[identifier] = {
          count: 1,
          resetTime: now + interval,
        }
        return
      }

      // 增加计数
      record.count++

      // 检查是否超限
      if (record.count > limit) {
        const resetInSeconds = Math.ceil((record.resetTime - now) / 1000)
        throw new Error(`操作过于频繁,请${resetInSeconds}秒后再试`)
      }
    },
  }
}


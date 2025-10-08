// src/lib/rateLimit.ts
// 简单的内存速率限制器（适用于单实例部署）
// 生产环境建议使用 Redis 进行分布式速率限制

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  
  /**
   * 检查速率限制
   * @param key 限制键（通常是 userId + action）
   * @param options 限制选项
   * @returns 是否允许请求及重置时间
   */
  check(
    key: string,
    options: {
      max: number // 最大请求数
      windowMs: number // 时间窗口（毫秒）
    }
  ): {
    success: boolean
    remaining: number
    resetIn: number
  } {
    const now = Date.now()
    const entry = this.store.get(key)
    
    // 如果没有记录或已过期，创建新记录
    if (!entry || now > entry.resetAt) {
      const resetAt = now + options.windowMs
      this.store.set(key, { count: 1, resetAt })
      
      return {
        success: true,
        remaining: options.max - 1,
        resetIn: Math.ceil(options.windowMs / 1000)
      }
    }
    
    // 检查是否超过限制
    if (entry.count >= options.max) {
      return {
        success: false,
        remaining: 0,
        resetIn: Math.ceil((entry.resetAt - now) / 1000)
      }
    }
    
    // 增加计数
    entry.count++
    this.store.set(key, entry)
    
    return {
      success: true,
      remaining: options.max - entry.count,
      resetIn: Math.ceil((entry.resetAt - now) / 1000)
    }
  }
  
  /**
   * 重置指定键的限制
   */
  reset(key: string): void {
    this.store.delete(key)
  }
  
  /**
   * 清理过期条目（定期清理以防止内存泄漏）
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

// 全局单例实例
export const rateLimiter = new RateLimiter()

// 定期清理过期条目（每 5 分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    rateLimiter.cleanup()
  }, 5 * 60 * 1000)
}

// 预定义的速率限制配置
export const RATE_LIMITS = {
  EXPORT: {
    max: 5, // 每分钟最多 5 次
    windowMs: 60 * 1000 // 1 分钟
  },
  BATCH_EXPORT: {
    max: 2, // 每 5 分钟最多 2 次（批量导出更耗资源）
    windowMs: 5 * 60 * 1000 // 5 分钟
  }
} as const

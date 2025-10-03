/**
 * 简单的内存速率限制器
 * 生产环境建议使用 Redis 实现分布式速率限制
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

// 清理过期的限流记录（每5分钟）
setInterval(() => {
  const now = Date.now()
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  })
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /**
   * 时间窗口（毫秒）
   * @default 3600000 (1小时)
   */
  windowMs?: number
  /**
   * 时间窗口内允许的最大请求数
   * @default 5
   */
  max?: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
}

/**
 * 速率限制检查
 * @param identifier 唯一标识符（通常是 IP 地址）
 * @param config 速率限制配置
 * @returns 速率限制结果
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  const windowMs = config.windowMs || 60 * 60 * 1000 // 默认 1 小时
  const max = config.max || 5 // 默认 5 次请求

  const now = Date.now()
  const record = store[identifier]

  // 如果没有记录或已过期，创建新记录
  if (!record || record.resetTime < now) {
    store[identifier] = {
      count: 1,
      resetTime: now + windowMs,
    }
    return {
      success: true,
      limit: max,
      remaining: max - 1,
      reset: new Date(now + windowMs),
    }
  }

  // 增加计数
  record.count++

  // 检查是否超限
  if (record.count > max) {
    return {
      success: false,
      limit: max,
      remaining: 0,
      reset: new Date(record.resetTime),
    }
  }

  return {
    success: true,
    limit: max,
    remaining: max - record.count,
    reset: new Date(record.resetTime),
  }
}

/**
 * 从 Next.js 请求中获取客户端 IP 地址
 */
export function getClientIp(request: Request): string {
  // 尝试从各种头部获取真实 IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // 降级到 'unknown'（测试环境）
  return 'unknown'
}


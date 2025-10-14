// src/lib/rateLimit.ts
// Upstash-based rate limiting with graceful degradation
// Story 4.1: Upload Rate Limiting with Redis fallback strategy

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Redis client for rate limiting
 * Uses Upstash Redis REST API
 */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

/**
 * Rate limit configuration for document uploads
 * - 10 requests per minute per user
 * - Sliding window algorithm for accurate limiting
 * - Analytics enabled for monitoring
 */
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: 'ratelimit:upload',
  // Timeout to prevent hanging requests
  timeout: 200, // 200ms timeout for Redis operations
})

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check upload rate limit for a user
 * 
 * CRITICAL: Implements graceful degradation strategy (OPS-001)
 * - If Redis fails, logs error and allows request through
 * - Prevents upload endpoint from becoming completely unavailable
 * - Monitors Redis failures for alerting
 * 
 * @param userId - User ID to check rate limit for
 * @returns Rate limit result with success, limit, remaining, and reset time
 */
export async function checkUploadRateLimit(userId: string): Promise<RateLimitResult> {
  const identifier = `upload:${userId}`
  
  try {
    // Call Upstash Rate Limit with timeout
    const { success, limit, remaining, reset } = await uploadRateLimit.limit(identifier)
    
    return {
      success,
      limit,
      remaining,
      reset
    }
  } catch (error) {
    // 🔴 CRITICAL: Graceful degradation strategy
    // Redis failure should NOT block upload functionality
    console.error('Rate limit check failed, degrading gracefully', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      identifier,
      timestamp: new Date().toISOString(),
      // Alert flag for monitoring
      alert: 'rateLimitDegradation'
    })
    
    // Allow request through on Redis failure
    // Rationale: Availability > Short-term security reduction
    return {
      success: true, // Allow through
      limit: 10,
      remaining: -1, // -1 indicates degraded mode
      reset: Date.now() + 60000 // 1 minute from now
    }
  }
}

/**
 * Log rate limit exceeded event
 * 
 * AC4: Logs超限事件with required fields
 * - userId, IP, timestamp
 * - Level: warn
 * - Tag: rateLimitExceeded for monitoring
 * 
 * @param userId - User ID
 * @param ip - Request IP address
 * @param details - Additional rate limit details
 */
export function logRateLimitExceeded(
  userId: string,
  ip: string,
  details: {
    limit: number
    remaining: number
    retryAfter: number
  }
) {
  console.warn({
    event: 'rateLimitExceeded',
    userId,
    ip,
    endpoint: '/api/documents/upload',
    timestamp: new Date().toISOString(),
    details
  })
}

// ==================== Legacy rate limiter (kept for backward compatibility) ====================
// This section is for export endpoint rate limiting (Story 3.6)
// TODO: Migrate to Upstash in future story

interface RateLimitEntry {
  count: number
  resetAt: number
}

class MemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  
  check(
    key: string,
    options: {
      max: number
      windowMs: number
    }
  ): {
    success: boolean
    remaining: number
    resetIn: number
  } {
    const now = Date.now()
    const entry = this.store.get(key)
    
    if (!entry || now > entry.resetAt) {
      const resetAt = now + options.windowMs
      this.store.set(key, { count: 1, resetAt })
      
      return {
        success: true,
        remaining: options.max - 1,
        resetIn: Math.ceil(options.windowMs / 1000)
      }
    }
    
    if (entry.count >= options.max) {
      return {
        success: false,
        remaining: 0,
        resetIn: Math.ceil((entry.resetAt - now) / 1000)
      }
    }
    
    entry.count++
    this.store.set(key, entry)
    
    return {
      success: true,
      remaining: options.max - entry.count,
      resetIn: Math.ceil((entry.resetAt - now) / 1000)
    }
  }
  
  reset(key: string): void {
    this.store.delete(key)
  }
  
  cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.store.entries())
    for (const [key, entry] of entries) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

export const rateLimiter = new MemoryRateLimiter()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    rateLimiter.cleanup()
  }, 5 * 60 * 1000)
}

export const RATE_LIMITS = {
  EXPORT: {
    max: 5,
    windowMs: 60 * 1000
  },
  BATCH_EXPORT: {
    max: 2,
    windowMs: 5 * 60 * 1000
  }
} as const

/**
 * Unit Tests: Rate Limiting Service
 * Story 4.1: Upload Rate Limiting
 * 
 * Test Coverage:
 * - 4.1-UNIT-001: Basic rate limit functionality
 * - 4.1-UNIT-002: Configuration verification
 * - 4.1-UNIT-003: Key generation and identifier formatting
 * - 4.1-UNIT-004: Mock Redis interactions
 * - 🔴 4.1-UNIT-007: Redis timeout degradation (CRITICAL)
 * - 🔴 4.1-UNIT-008: Redis error degradation (CRITICAL)
 * - 4.1-UNIT-005: Log function called correctly
 * - 4.1-UNIT-006: Log content verification
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// CRITICAL: Mock MUST be before import
const mockLimit = jest.fn()
const mockRatelimitConstructor = jest.fn().mockImplementation(() => ({
  limit: mockLimit
}))

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: mockRatelimitConstructor
}))

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({}))
}))

// Import AFTER mocks are set up
import { checkUploadRateLimit, logRateLimitExceeded } from '@/lib/rateLimit'

describe('checkUploadRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset console spies
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // 4.1-UNIT-001: Basic functionality
  it('should allow request within limit', async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000
    })

    const result = await checkUploadRateLimit('user_test_123')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
    expect(mockLimit).toHaveBeenCalledWith('upload:user_test_123')
  })

  // 4.1-UNIT-002: Configuration verification
  it('should return correct rate limit configuration', async () => {
    const resetTime = Date.now() + 60000
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 5,
      reset: resetTime
    })

    const result = await checkUploadRateLimit('user_config_test')

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('remaining')
    expect(result).toHaveProperty('reset')
    expect(result.limit).toBe(10)
    expect(typeof result.reset).toBe('number')
  })

  // 4.1-UNIT-003: Key generation
  it('should format identifier correctly', async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 8,
      reset: Date.now() + 60000
    })

    await checkUploadRateLimit('user_key_test')

    expect(mockLimit).toHaveBeenCalledWith('upload:user_key_test')
  })

  // 4.1-UNIT-004: Mock Redis response
  it('should handle rate limit exceeded correctly', async () => {
    const resetTime = Date.now() + 45000
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetTime
    })

    const result = await checkUploadRateLimit('user_exceeded_test')

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.reset).toBe(resetTime)
  })

  // 🔴 4.1-UNIT-007: Redis timeout degradation (CRITICAL)
  it('should degrade gracefully on Redis timeout', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error')
    
    // Simulate timeout error
    mockLimit.mockRejectedValue(new Error('Request timeout'))

    const result = await checkUploadRateLimit('user_timeout_test')

    // Should allow through on degradation
    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(-1) // -1 indicates degraded mode
    
    // Should log error with alert flag
    expect(consoleErrorSpy).toHaveBeenCalled()
    const errorLog = consoleErrorSpy.mock.calls[0][0]
    expect(errorLog).toMatchObject({
      error: expect.stringContaining('timeout'),
      userId: 'user_timeout_test',
      alert: 'rateLimitDegradation'
    })
  })

  // 🔴 4.1-UNIT-008: Redis error degradation (CRITICAL)
  it('should degrade gracefully on Redis error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error')
    
    // Simulate Redis connection error
    mockLimit.mockRejectedValue(new Error('Redis connection failed'))

    const result = await checkUploadRateLimit('user_error_test')

    // Should allow through on degradation
    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(-1)
    
    // Should log error properly
    expect(consoleErrorSpy).toHaveBeenCalled()
    const errorLog = consoleErrorSpy.mock.calls[0][0]
    expect(errorLog).toMatchObject({
      error: expect.stringContaining('connection failed'),
      userId: 'user_error_test',
      identifier: 'upload:user_error_test',
      alert: 'rateLimitDegradation'
    })
  })

  // 4.1-UNIT-007 variant: Network error degradation
  it('should degrade gracefully on network error', async () => {
    mockLimit.mockRejectedValue(new Error('Network unreachable'))

    const result = await checkUploadRateLimit('user_network_test')

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(-1)
  })
})

describe('logRateLimitExceeded', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // 4.1-UNIT-005: Log function called
  it('should log rate limit exceeded with correct level', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn')

    logRateLimitExceeded('user_log_test', '192.168.1.1', {
      limit: 10,
      remaining: 0,
      retryAfter: 30
    })

    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  // 4.1-UNIT-006: Log content verification
  it('should include all required fields in log', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn')

    logRateLimitExceeded('user_fields_test', '10.0.0.1', {
      limit: 10,
      remaining: 0,
      retryAfter: 45
    })

    expect(consoleWarnSpy).toHaveBeenCalled()
    const logData = consoleWarnSpy.mock.calls[0][0]

    // AC4: Required fields
    expect(logData).toMatchObject({
      event: 'rateLimitExceeded',
      userId: 'user_fields_test',
      ip: '10.0.0.1',
      endpoint: '/api/documents/upload',
      timestamp: expect.any(String),
      details: {
        limit: 10,
        remaining: 0,
        retryAfter: 45
      }
    })
  })

  it('should handle unknown IP gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn')

    logRateLimitExceeded('user_no_ip', 'unknown', {
      limit: 10,
      remaining: 0,
      retryAfter: 60
    })

    const logData = consoleWarnSpy.mock.calls[0][0]
    expect(logData.ip).toBe('unknown')
  })

  it('should include ISO 8601 timestamp', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn')

    logRateLimitExceeded('user_timestamp_test', '1.2.3.4', {
      limit: 10,
      remaining: 0,
      retryAfter: 20
    })

    const logData = consoleWarnSpy.mock.calls[0][0]
    expect(logData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})


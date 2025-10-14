/**
 * Integration Tests: Upload API Rate Limiting
 * Story 4.1: Upload Rate Limiting
 * 
 * Test Coverage:
 * - 4.1-INT-001: Integration verification
 * - 4.1-INT-002: 10 consecutive uploads succeed
 * - 🔴 4.1-INT-003: 11th upload returns 429 (CRITICAL - boundary test)
 * - 4.1-INT-005: 429 status code verification
 * - 4.1-INT-006: Retry-After header present
 * - 4.1-INT-007: Chinese error message
 * - 4.1-INT-008: Rate limit details in response
 * - 4.1-INT-010: Actual log output verification
 * - 🔴 4.1-INT-011: Redis unavailable degradation (CRITICAL)
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { POST } from '@/app/api/documents/upload/route'
import { createMocks } from 'node-mocks-http'
import * as authModule from '@/lib/auth'
import * as rateLimitModule from '@/lib/rateLimit'

// Mock auth
jest.mock('@/lib/auth')
const mockAuth = authModule.auth as jest.MockedFunction<typeof authModule.auth>

// Mock database operations
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{
      userId: 'test-user-id',
      documentCount: 5,
      storageUsed: 1000000,
      queryCount: 10,
      queryResetDate: new Date()
    }]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{
      id: 'doc-test-id',
      userId: 'test-user-id',
      filename: 'test.txt',
      status: 'PENDING',
      uploadedAt: new Date()
    }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis()
  }
}))

// Mock storage service
jest.mock('@/services/documents/storageService', () => ({
  StorageService: {
    uploadFile: jest.fn().mockResolvedValue('test-user-id/doc-test-id.txt'),
    deleteFile: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock file validator
jest.mock('@/lib/file-validator', () => ({
  validateFileSize: jest.fn().mockReturnValue({ valid: true }),
  validateFileExtension: jest.fn().mockReturnValue({ valid: true }),
  validateFileType: jest.fn().mockResolvedValue({ valid: true, detectedType: 'text/plain' }),
  sanitizeFilename: jest.fn((name: string) => name)
}))

describe('POST /api/documents/upload - Rate Limiting Integration', () => {
  const testUserId = 'user_rate_limit_test'
  
  beforeAll(() => {
    // Mock authenticated session
    mockAuth.mockResolvedValue({
      user: {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User'
      },
      expires: new Date(Date.now() + 86400000).toISOString()
    })
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Helper: Create mock request with file
   */
  function createMockUploadRequest(): Request {
    const formData = new FormData()
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    formData.append('file', file)

    return new Request('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData
    })
  }

  // 4.1-INT-001: Basic integration verification
  it('should integrate rate limiting with upload flow', async () => {
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)

    expect(rateLimitModule.checkUploadRateLimit).toHaveBeenCalledWith(testUserId)
    expect(response.status).not.toBe(429)
  })

  // 4.1-INT-002 & 🔴 4.1-INT-003: Boundary test - 10 succeed, 11th fails
  it('should allow 10 requests and block the 11th', async () => {
    const checkRateLimitSpy = jest.spyOn(rateLimitModule, 'checkUploadRateLimit')
    
    // Simulate sliding window: first 10 succeed, 11th fails
    let callCount = 0
    checkRateLimitSpy.mockImplementation(async () => {
      callCount++
      if (callCount <= 10) {
        return {
          success: true,
          limit: 10,
          remaining: 10 - callCount,
          reset: Date.now() + 60000
        }
      } else {
        return {
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 45000
        }
      }
    })

    // Make 11 requests
    const responses: Response[] = []
    for (let i = 0; i < 11; i++) {
      const req = createMockUploadRequest()
      const response = await POST(req as any)
      responses.push(response)
    }

    // First 10 should succeed (not 429)
    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).not.toBe(429)
    }

    // 11th should be rate limited
    expect(responses[10].status).toBe(429)
  }, 30000) // Extended timeout for multiple requests

  // 4.1-INT-005: 429 status code
  it('should return 429 status when rate limit exceeded', async () => {
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30000
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)

    expect(response.status).toBe(429)
  })

  // 4.1-INT-006: Retry-After header
  it('should include Retry-After header in 429 response', async () => {
    const resetTime = Date.now() + 45000
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetTime
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)

    const retryAfter = response.headers.get('Retry-After')
    expect(retryAfter).toBeTruthy()
    expect(Number(retryAfter)).toBeGreaterThan(0)
    expect(Number(retryAfter)).toBeLessThanOrEqual(60)
  })

  // 4.1-INT-007: Chinese error message
  it('should return Chinese error message', async () => {
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30000
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)
    const data = await response.json()

    expect(data.error).toContain('上传过于频繁')
    expect(data.error).toContain('请稍后再试')
  })

  // 4.1-INT-008: Rate limit details in response
  it('should include detailed rate limit info in response body', async () => {
    const resetTime = Date.now() + 40000
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetTime
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)
    const data = await response.json()

    expect(data.details).toBeDefined()
    expect(data.details.limit).toBe(10)
    expect(data.details.remaining).toBe(0)
    expect(data.details.retryAfter).toBeGreaterThan(0)
    expect(data.details.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  // Additional: X-RateLimit headers
  it('should include X-RateLimit-* headers', async () => {
    const resetTime = Date.now() + 30000
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetTime
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe(resetTime.toString())
  })

  // 4.1-INT-010: Actual log output
  it('should log rate limit exceeded events', async () => {
    const logSpy = jest.spyOn(rateLimitModule, 'logRateLimitExceeded')
    
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 30000
    })

    const req = createMockUploadRequest()
    await POST(req as any)

    expect(logSpy).toHaveBeenCalledWith(
      testUserId,
      expect.any(String), // IP
      expect.objectContaining({
        limit: 10,
        remaining: 0,
        retryAfter: expect.any(Number)
      })
    )
  })

  // 🔴 4.1-INT-011: Redis unavailable - graceful degradation (CRITICAL)
  it('should allow upload when Redis is unavailable (degradation)', async () => {
    // Simulate checkUploadRateLimit returning degraded response
    jest.spyOn(rateLimitModule, 'checkUploadRateLimit').mockResolvedValue({
      success: true, // Degraded mode allows through
      limit: 10,
      remaining: -1, // -1 indicates degraded mode
      reset: Date.now() + 60000
    })

    const req = createMockUploadRequest()
    const response = await POST(req as any)

    // Should NOT return 429, upload should succeed
    expect(response.status).not.toBe(429)
    expect(response.status).toBeLessThan(400)
  })

  // 4.1-INT-004: Multiple users isolated
  it('should isolate rate limits per user', async () => {
    const checkRateLimitSpy = jest.spyOn(rateLimitModule, 'checkUploadRateLimit')
    
    checkRateLimitSpy.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 5,
      reset: Date.now() + 60000
    })

    // User 1
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user_1', email: 'user1@test.com', name: 'User 1' },
      expires: new Date(Date.now() + 86400000).toISOString()
    })
    const req1 = createMockUploadRequest()
    await POST(req1 as any)

    // User 2
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user_2', email: 'user2@test.com', name: 'User 2' },
      expires: new Date(Date.now() + 86400000).toISOString()
    })
    const req2 = createMockUploadRequest()
    await POST(req2 as any)

    // Should be called with different user IDs
    expect(checkRateLimitSpy).toHaveBeenCalledWith('user_1')
    expect(checkRateLimitSpy).toHaveBeenCalledWith('user_2')
  })
})


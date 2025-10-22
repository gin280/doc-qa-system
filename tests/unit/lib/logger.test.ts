/**
 * Logger单元测试
 * Story 4.12: Axiom日志集成 - Logger单元测试
 * 测试范围：Logger实例创建、环境配置、辅助函数
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock环境变量
const originalEnv = process.env

describe('Logger', () => {
  beforeEach(() => {
    // 重置模块缓存，确保每次测试都重新加载logger
    jest.resetModules()
    // 清空环境变量
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv
  })

  describe('Logger实例创建', () => {
    it('应该成功创建logger实例', async () => {
      const { logger } = await import('@/lib/logger')
      
      expect(logger).toBeDefined()
      expect(logger.info).toBeInstanceOf(Function)
      expect(logger.error).toBeInstanceOf(Function)
      expect(logger.warn).toBeInstanceOf(Function)
      expect(logger.debug).toBeInstanceOf(Function)
    })

    it('development环境应该使用pino-pretty transport', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.AXIOM_TOKEN
      
      const { logger } = await import('@/lib/logger')
      
      // 验证logger被创建
      expect(logger).toBeDefined()
      // 在development环境下，应该有pino-pretty的配置
      // 这个测试验证logger可以正常工作
      expect(() => logger.info('test')).not.toThrow()
    })

    it('production环境且有AXIOM_TOKEN应该使用pino-axiom transport', async () => {
      process.env.NODE_ENV = 'production'
      process.env.AXIOM_TOKEN = 'test-token-12345'
      process.env.AXIOM_DATASET = 'test-dataset'
      process.env.AXIOM_ORG_ID = 'test-org-id'
      
      const { logger } = await import('@/lib/logger')
      
      // 验证logger被创建
      expect(logger).toBeDefined()
      // 验证logger可以正常工作
      expect(() => logger.info('test')).not.toThrow()
    })

    it('production环境没有AXIOM_TOKEN应该回退到console输出', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.AXIOM_TOKEN
      
      const { logger } = await import('@/lib/logger')
      
      // 验证logger被创建并可以工作
      expect(logger).toBeDefined()
      expect(() => logger.info('test')).not.toThrow()
    })
  })

  describe('环境变量配置', () => {
    it('应该正确读取LOG_LEVEL环境变量', async () => {
      process.env.LOG_LEVEL = 'debug'
      
      const { logger } = await import('@/lib/logger')
      
      expect(logger).toBeDefined()
      // debug级别日志应该可以记录
      expect(() => logger.debug('test debug message')).not.toThrow()
    })

    it('应该使用默认LOG_LEVEL为info', async () => {
      delete process.env.LOG_LEVEL
      
      const { logger } = await import('@/lib/logger')
      
      expect(logger).toBeDefined()
      expect(() => logger.info('test info message')).not.toThrow()
    })

    it('应该正确处理AXIOM环境变量', async () => {
      process.env.NODE_ENV = 'production'
      process.env.AXIOM_TOKEN = 'test-token'
      process.env.AXIOM_DATASET = 'test-dataset'
      process.env.AXIOM_ORG_ID = 'test-org'
      
      const { logger } = await import('@/lib/logger')
      
      expect(logger).toBeDefined()
    })
  })

  describe('sanitizeQuery 查询截断函数', () => {
    it('应该截断超过100字符的查询', async () => {
      const { sanitizeQuery } = await import('@/lib/logger')
      
      const longQuery = 'A'.repeat(150)
      const sanitized = sanitizeQuery(longQuery)
      
      expect(sanitized).toHaveLength(103) // 100 + '...'
      expect(sanitized.endsWith('...')).toBe(true)
    })

    it('应该保留短查询不变', async () => {
      const { sanitizeQuery } = await import('@/lib/logger')
      
      const shortQuery = '这是一个短查询'
      const sanitized = sanitizeQuery(shortQuery)
      
      expect(sanitized).toBe(shortQuery)
    })

    it('应该处理空字符串', async () => {
      const { sanitizeQuery } = await import('@/lib/logger')
      
      const sanitized = sanitizeQuery('')
      
      expect(sanitized).toBe('')
    })

    it('应该处理正好100字符的查询', async () => {
      const { sanitizeQuery } = await import('@/lib/logger')
      
      const exactQuery = 'A'.repeat(100)
      const sanitized = sanitizeQuery(exactQuery)
      
      expect(sanitized).toBe(exactQuery)
      expect(sanitized).toHaveLength(100)
    })

    it('应该处理包含特殊字符的查询', async () => {
      const { sanitizeQuery } = await import('@/lib/logger')
      
      const specialQuery = '这是包含特殊字符的查询：<>&"\''
      const sanitized = sanitizeQuery(specialQuery)
      
      expect(sanitized).toBe(specialQuery)
    })
  })

  describe('sanitizeEmail 邮箱脱敏函数', () => {
    it('应该正确脱敏标准邮箱', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const email = 'test@example.com'
      const sanitized = sanitizeEmail(email)
      
      expect(sanitized).toBe('t***@example.com')
    })

    it('应该处理短邮箱（1个字符用户名）', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const email = 'a@example.com'
      const sanitized = sanitizeEmail(email)
      
      expect(sanitized).toBe('a***@example.com')
    })

    it('应该处理长邮箱用户名', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const email = 'verylongemail@example.com'
      const sanitized = sanitizeEmail(email)
      
      expect(sanitized).toBe('v***@example.com')
    })

    it('应该处理包含点号的邮箱', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const email = 'first.last@example.com'
      const sanitized = sanitizeEmail(email)
      
      expect(sanitized).toBe('f***@example.com')
    })

    it('应该处理无效邮箱格式', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const invalidEmail = 'not-an-email'
      const sanitized = sanitizeEmail(invalidEmail)
      
      // 对于无效格式（不包含@），正则不匹配，返回原字符串
      expect(sanitized).toBe('not-an-email')
    })

    it('应该处理空字符串', async () => {
      const { sanitizeEmail } = await import('@/lib/logger')
      
      const sanitized = sanitizeEmail('')
      
      // 空字符串不匹配正则，返回原字符串
      expect(sanitized).toBe('')
    })
  })

  describe('logError 错误日志辅助函数', () => {
    it('应该正确记录Error对象', async () => {
      const { logger, logError } = await import('@/lib/logger')
      
      const error = new Error('Test error message')
      const context = { userId: 'user-123', action: 'test_action' }
      
      // Mock logger.error
      const errorSpy = jest.spyOn(logger, 'error')
      
      // logError 签名是 (error, context)，消息固定为 "Operation failed"
      logError(error, context)
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Test error message',
          stack: expect.any(String),
          userId: 'user-123',
          action: 'test_action'
        }),
        'Operation failed'
      )
      
      errorSpy.mockRestore()
    })

    it('应该处理字符串错误', async () => {
      const { logger, logError } = await import('@/lib/logger')
      
      const errorSpy = jest.spyOn(logger, 'error')
      
      // logError 签名是 (error, context)
      logError('Simple error string', {})
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Simple error string',
          stack: undefined
        }),
        'Operation failed'
      )
      
      errorSpy.mockRestore()
    })

    it('应该处理带堆栈的错误', async () => {
      const { logger, logError } = await import('@/lib/logger')
      
      const error = new Error('Error with stack')
      error.stack = 'Error: Error with stack\n    at test.ts:10:15'
      
      const errorSpy = jest.spyOn(logger, 'error')
      
      // logError 签名是 (error, context)
      logError(error, {})
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error with stack',
          stack: expect.stringContaining('Error: Error with stack')
        }),
        'Operation failed'
      )
      
      errorSpy.mockRestore()
    })

    it('应该合并额外的context信息', async () => {
      const { logger, logError } = await import('@/lib/logger')
      
      const error = new Error('Test')
      const context = {
        userId: 'user-456',
        documentId: 'doc-789',
        operation: 'upload',
        timestamp: '2025-01-15T10:00:00Z'
      }
      
      const errorSpy = jest.spyOn(logger, 'error')
      
      // logError 签名是 (error, context)
      logError(error, context)
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          documentId: 'doc-789',
          operation: 'upload',
          timestamp: '2025-01-15T10:00:00Z',
          error: 'Test',
          stack: expect.any(String)
        }),
        'Operation failed'
      )
      
      errorSpy.mockRestore()
    })
  })

  describe('Logger 日志级别', () => {
    it('应该支持所有日志级别', async () => {
      const { logger } = await import('@/lib/logger')
      
      expect(() => logger.fatal('fatal message')).not.toThrow()
      expect(() => logger.error('error message')).not.toThrow()
      expect(() => logger.warn('warn message')).not.toThrow()
      expect(() => logger.info('info message')).not.toThrow()
      expect(() => logger.debug('debug message')).not.toThrow()
      expect(() => logger.trace('trace message')).not.toThrow()
    })

    it('应该支持结构化日志', async () => {
      const { logger } = await import('@/lib/logger')
      
      expect(() => {
        logger.info({
          userId: 'user-123',
          action: 'test_action',
          duration: 100,
          metadata: { key: 'value' }
        }, 'Structured log message')
      }).not.toThrow()
    })
  })

  describe('Logger 性能', () => {
    it('应该能快速记录大量日志', async () => {
      const { logger } = await import('@/lib/logger')
      
      const startTime = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        logger.info({ iteration: i, action: 'performance_test' }, `Log ${i}`)
      }
      
      const duration = Date.now() - startTime
      
      // 1000条日志应该在1秒内完成（Pino非常快）
      expect(duration).toBeLessThan(1000)
    })
  })
})


import { describe, it, expect, vi, beforeEach, afterEach } from '@jest/globals'
import { 
  validateVectorDimension, 
  getExpectedDimensionForProvider,
  assertValidVectorConfig
} from '@/lib/validate-vector-config'

describe('validate-vector-config', () => {
  describe('getExpectedDimensionForProvider', () => {
    it('应该为 zhipu 返回 1024', () => {
      expect(getExpectedDimensionForProvider('zhipu')).toBe(1024)
    })

    it('应该为 openai 返回 1536', () => {
      expect(getExpectedDimensionForProvider('openai')).toBe(1536)
    })

    it('应该为未知provider抛出错误', () => {
      expect(() => getExpectedDimensionForProvider('unknown'))
        .toThrow(/Unknown provider/)
    })
    
    it('应该为空字符串provider抛出错误', () => {
      expect(() => getExpectedDimensionForProvider(''))
        .toThrow(/Unknown provider/)
    })
  })

  describe('validateVectorDimension', () => {
    it('应该在配置正确时验证通过 (zhipu + 1024)', () => {
      // 注意：这个测试依赖实际的 llmConfig
      // 当前配置是 zhipu + 1024
      
      const result = validateVectorDimension()
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该在生产环境返回警告', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const result = validateVectorDimension()
      
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('re-processing all documents')
      
      process.env.NODE_ENV = originalEnv
    })
    
    it('应该在开发环境不返回警告', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const result = validateVectorDimension()
      
      // 如果配置正确，不应该有警告
      if (result.valid) {
        expect(result.warnings).toHaveLength(0)
      }
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('assertValidVectorConfig', () => {
    let consoleLogSpy: any
    let consoleErrorSpy: any
    let consoleWarnSpy: any
    
    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    
    afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('应该在配置正确时记录成功日志', () => {
      // 当前配置是正确的 (zhipu + 1024)
      assertValidVectorConfig()
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Vector Config] ✓ Configuration valid')
      )
    })
    
    it('应该在生产环境记录警告', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      assertValidVectorConfig()
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Vector Config] Warnings:',
        expect.arrayContaining([
          expect.stringContaining('re-processing all documents')
        ])
      )
      
      process.env.NODE_ENV = originalEnv
    })
  })
  
  describe('错误处理', () => {
    it('应该捕获验证过程中的异常', () => {
      // validateVectorDimension 应该不会抛出异常，而是返回错误
      const result = validateVectorDimension()
      
      // 结果应该包含 valid、errors、warnings 字段
      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
    })
  })
})


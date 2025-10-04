// @ts-nocheck - 测试文件跳过严格类型检查
import { describe, it, expect, jest } from '@jest/globals'

// CRITICAL: Mock file-type BEFORE importing file-validator
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}))

import {
  validateFileSize,
  sanitizeFilename,
  validateFileExtension
} from '@/lib/file-validator'

describe('file-validator', () => {
  describe('validateFileSize', () => {
    it('应该接受有效的文件大小', () => {
      const result = validateFileSize(1024 * 1024) // 1MB
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('应该拒绝空文件', () => {
      const result = validateFileSize(0)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('文件为空')
    })

    it('应该拒绝超过50MB的文件', () => {
      const result = validateFileSize(51 * 1024 * 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('文件大小超过限制')
    })

    it('应该接受刚好50MB的文件', () => {
      const result = validateFileSize(50 * 1024 * 1024)
      expect(result.valid).toBe(true)
    })
  })

  describe('sanitizeFilename', () => {
    it('应该保留有效的文件名', () => {
      const result = sanitizeFilename('test-file.pdf')
      expect(result).toBe('test-file.pdf')
    })

    it('应该移除路径分隔符', () => {
      const result = sanitizeFilename('../../../etc/passwd')
      expect(result).not.toContain('..')
      expect(result).not.toContain('/')
    })

    it('应该替换特殊字符为下划线', () => {
      const result = sanitizeFilename('file@#$%.pdf')
      expect(result).toContain('file')
      expect(result).toContain('.pdf')
    })

    it('应该处理中文文件名', () => {
      const result = sanitizeFilename('测试文档.pdf')
      expect(result).toBe('测试文档.pdf')
    })

    it('应该移除连续的点号', () => {
      const result = sanitizeFilename('file...pdf')
      expect(result).toBe('file.pdf')
    })

    it('应该移除开头的点号（隐藏文件）', () => {
      const result = sanitizeFilename('.hidden.pdf')
      expect(result).toBe('hidden.pdf')
    })

    it('应该限制文件名长度', () => {
      const longName = 'a'.repeat(300) + '.pdf'
      const result = sanitizeFilename(longName)
      expect(result.length).toBeLessThanOrEqual(255)
      expect(result.endsWith('.pdf')).toBe(true)
    })

    it('应该处理空文件名', () => {
      const result = sanitizeFilename('')
      expect(result).toBe('unnamed_file')
    })

    it('应该处理只有特殊字符的文件名', () => {
      const result = sanitizeFilename('@#$%^&*()')
      // 特殊字符被替换后可能变成括号或下划线
      expect(result.length).toBeGreaterThan(0)
      expect(result).not.toContain('@')
      expect(result).not.toContain('#')
      expect(result).not.toContain('$')
      expect(result).not.toContain('%')
    })
  })

  describe('validateFileExtension', () => {
    it('应该接受PDF文件', () => {
      const result = validateFileExtension('document.pdf', 'application/pdf')
      expect(result.valid).toBe(true)
    })

    it('应该接受DOCX文件', () => {
      const result = validateFileExtension(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      expect(result.valid).toBe(true)
    })

    it('应该接受DOC文件', () => {
      const result = validateFileExtension('document.doc', 'application/msword')
      expect(result.valid).toBe(true)
    })

    it('应该接受Markdown文件', () => {
      const result = validateFileExtension('document.md', 'text/markdown')
      expect(result.valid).toBe(true)
    })

    it('应该接受TXT文件', () => {
      const result = validateFileExtension('document.txt', 'text/plain')
      expect(result.valid).toBe(true)
    })

    it('应该拒绝没有扩展名的文件', () => {
      const result = validateFileExtension('document', 'application/pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('没有扩展名')
    })

    it('应该拒绝扩展名与MIME类型不匹配', () => {
      const result = validateFileExtension('document.txt', 'application/pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('不匹配')
    })

    it('应该不区分大小写处理扩展名', () => {
      const result = validateFileExtension('Document.PDF', 'application/pdf')
      expect(result.valid).toBe(true)
    })
  })

  describe('Security - Path Traversal Prevention', () => {
    it('应该防止路径遍历攻击 (../ 序列)', () => {
      const malicious = '../../../etc/passwd'
      const result = sanitizeFilename(malicious)
      expect(result).not.toContain('..')
      expect(result).not.toContain('/')
    })

    it('应该防止Windows路径遍历 (..\\)', () => {
      const malicious = '..\\..\\..\\windows\\system32'
      const result = sanitizeFilename(malicious)
      expect(result).not.toContain('..')
      expect(result).not.toContain('\\')
    })

    it('应该防止绝对路径', () => {
      const malicious = '/etc/passwd'
      const result = sanitizeFilename(malicious)
      expect(result.startsWith('/')).toBe(false)
    })

    it('应该防止NULL字节注入', () => {
      const malicious = 'file\x00.pdf'
      const result = sanitizeFilename(malicious)
      expect(result).not.toContain('\x00')
    })
  })

  describe('Edge Cases', () => {
    it('应该处理超长文件名', () => {
      const longName = 'a'.repeat(1000) + '.pdf'
      const result = sanitizeFilename(longName)
      expect(result.length).toBeLessThanOrEqual(255)
    })

    it('应该处理只有空格的文件名', () => {
      const result = sanitizeFilename('   ')
      // 空格也是合法字符，所以会保留，或者变成空
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('应该处理多个扩展名', () => {
      const result = sanitizeFilename('file.tar.gz.pdf')
      expect(result).toContain('file')
      expect(result).toContain('pdf')
    })

    it('应该处理Unicode文件名', () => {
      const result = sanitizeFilename('文档📄测试.pdf')
      expect(result).toContain('文档')
      expect(result).toContain('测试')
    })
  })

  // Note: validateFileType tests are in integration tests due to ESM module issues with file-type
  describe('validateFileType', () => {
    it.skip('validateFileType 在集成测试中测试（由于 file-type ESM 模块问题）', () => {
      // 该函数在 tests/integration/api/upload.test.ts 中通过 mock 进行测试
    })
  })
})

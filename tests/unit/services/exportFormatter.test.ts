// tests/unit/services/exportFormatter.test.ts
import {
  sanitizeFilename,
  formatDate,
  formatDateForFilename,
  generateExportFilename,
  generateBatchExportFolderName
} from '@/services/export/exportFormatter'

describe('exportFormatter', () => {
  describe('sanitizeFilename', () => {
    it('should remove illegal characters', () => {
      const input = 'test<>:"/\\|?*file'
      const result = sanitizeFilename(input)
      expect(result).not.toMatch(/[<>:"/\\|?*]/)
    })

    it('should replace spaces with underscores', () => {
      const input = 'test file name'
      const result = sanitizeFilename(input)
      expect(result).toBe('test_file_name')
    })

    it('should limit filename length to 100 characters', () => {
      const input = 'a'.repeat(200)
      const result = sanitizeFilename(input)
      expect(result.length).toBeLessThanOrEqual(100)
    })
  })

  describe('formatDate', () => {
    it('should format date in Chinese format', () => {
      const date = new Date('2025-01-08T10:30:00')
      const result = formatDate(date)
      expect(result).toMatch(/年.*月.*日/)
    })
  })

  describe('formatDateForFilename', () => {
    it('should format date for filename', () => {
      const date = new Date('2025-01-08T10:30:45')
      const result = formatDateForFilename(date)
      expect(result).toMatch(/^\d{8}_\d{6}$/)
      expect(result).toBe('20250108_103045')
    })
  })

  describe('generateExportFilename', () => {
    it('should generate markdown filename', () => {
      const date = new Date('2025-01-08T10:30:00')
      const result = generateExportFilename('My Conversation', 'markdown', date)
      expect(result).toMatch(/^My_Conversation_\d{8}_\d{6}\.md$/)
    })

    it('should generate PDF filename', () => {
      const date = new Date('2025-01-08T10:30:00')
      const result = generateExportFilename('My Conversation', 'pdf', date)
      expect(result).toMatch(/^My_Conversation_\d{8}_\d{6}\.pdf$/)
    })
  })

  describe('generateBatchExportFolderName', () => {
    it('should generate batch export folder name', () => {
      const date = new Date('2025-01-08T10:30:00')
      const result = generateBatchExportFolderName(date)
      expect(result).toMatch(/^对话导出_\d{8}_\d{6}$/)
    })
  })
})

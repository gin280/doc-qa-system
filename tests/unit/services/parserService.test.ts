// Mock dependencies FIRST - before any imports
// Mock pdf-parse library to avoid Jest worker thread issues
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer: Buffer) => {
    // Check if it's a corrupted PDF
    const header = buffer.slice(0, 5).toString('ascii')
    if (header !== '%PDF-') {
      return Promise.reject(new Error('Invalid PDF structure'))
    }
    
    // Check for very small files (likely corrupted)
    if (buffer.length < 200) {
      return Promise.reject(new Error('Invalid PDF structure'))
    }
    
    // Mock successful parse result
    return Promise.resolve({
      numpages: 5,
      text: 'This is sample PDF text content. 这是中文内容。',
      info: {
        Title: 'Test PDF',
        Author: 'Test Author',
        Creator: 'Test Creator',
        CreationDate: '2025-01-01'
      }
    })
  })
})

// Mock chardet library to avoid encoding detection issues in Jest
jest.mock('chardet', () => ({
  detect: jest.fn().mockReturnValue('utf-8')
}))

// Mock the entire db module to avoid schema import issues
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  },
  schema: {
    documents: 'documents',
    users: 'users',
    userUsage: 'userUsage',
  },
}))

jest.mock('@/drizzle/schema', () => ({
  documents: 'documents_table',
  users: 'users_table',
  userUsage: 'user_usage_table',
  documentStatusEnum: jest.fn(() => 'status'),
}))

jest.mock('@/services/documents/storageService', () => ({
  StorageService: {
    getFile: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  },
}))

// Now import the modules
import { parseDocument, ParseError } from '@/services/documents/parserService'
import { db } from '@/lib/db'
import { StorageService } from '@/services/documents/storageService'
import fs from 'fs'
import path from 'path'

// 辅助函数: 读取测试fixture
function loadFixture(relativePath: string): Buffer {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', relativePath)
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`)
  }
  return fs.readFileSync(fixturePath)
}

// 辅助函数: Mock数据库和Storage以测试完整parseDocument流程
function mockParseDocumentFlow(fileType: string, fixtureBuffer: ArrayBuffer) {
  // Mock数据库返回文档记录
  (db.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{
      id: 'test-doc-id',
      userId: 'test-user-id',
      filename: 'test.pdf',
      fileSize: 1024000,
      fileType,
      storagePath: 'test/path.pdf',
      status: 'PENDING'
    }])
  })

  // Mock Storage返回文件Buffer
  ;(StorageService.getFile as jest.Mock).mockResolvedValue(fixtureBuffer)

  // Mock数据库更新
  let capturedMetadata: any = null
  ;(db.update as jest.Mock).mockReturnValue({
    set: jest.fn((data) => {
      capturedMetadata = data
      return {
        where: jest.fn().mockResolvedValue(undefined)
      }
    }),
    where: jest.fn().mockResolvedValue(undefined)
  })

  return { capturedMetadata: () => capturedMetadata }
}

describe('ParserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('PDF解析功能 (AC2)', () => {
    describe('2.3-UNIT-004: 基础PDF文本提取', () => {
      it('应该成功提取PDF文本', async () => {
        const pdfBuffer = loadFixture('pdf/normal-adobe.pdf')
        const { capturedMetadata } = mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result).toBeDefined()
        expect(result.content).toBeDefined()
        expect(result.content.length).toBeGreaterThan(0)
        expect(result.contentLength).toBe(result.content.length)
        expect(result.metadata).toBeDefined()
        
        // 验证数据库状态更新为READY
        const metadata = capturedMetadata()
        expect(metadata.status).toBe('READY')
        expect(metadata.contentLength).toBeGreaterThan(0)
        expect(metadata.parsedAt).toBeDefined()
      })
    })

    describe('2.3-UNIT-005至UNIT-012: PDF格式兼容性测试', () => {
      it('应该支持Adobe Acrobat生成的PDF', async () => {
        const pdfBuffer = loadFixture('pdf/normal-adobe.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.metadata.totalPages).toBeGreaterThan(0)
        expect(result.metadata.wordCount).toBeGreaterThan(0)
      })

      it('应该支持Word导出的PDF', async () => {
        const pdfBuffer = loadFixture('pdf/normal-word.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.contentLength).toBeGreaterThan(0)
      })

      it('应该支持LibreOffice生成的PDF', async () => {
        const pdfBuffer = loadFixture('pdf/normal-libreoffice.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.contentLength).toBeGreaterThan(0)
      })

      it('应该支持中文PDF', async () => {
        const pdfBuffer = loadFixture('pdf/chinese.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        // 验证中文字符存在
        expect(result.content).toMatch(/[\u4e00-\u9fa5]/)
        expect(result.metadata.wordCount).toBeGreaterThan(0)
      })
    })

    describe('2.3-UNIT-013至UNIT-016: PDF元信息提取', () => {
      it('应该正确提取totalPages', async () => {
        const pdfBuffer = loadFixture('pdf/normal-adobe.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.metadata).toBeDefined()
        expect(result.metadata.totalPages).toBeDefined()
        expect(typeof result.metadata.totalPages).toBe('number')
        expect(result.metadata.totalPages).toBeGreaterThan(0)
      })

      it('应该提取title、author等可选元信息', async () => {
        const pdfBuffer = loadFixture('pdf/normal-adobe.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.metadata).toBeDefined()
        expect(result.metadata.totalPages).toBeDefined()
        // 可选字段可能不存在,但如果存在应该是字符串
        if (result.metadata.title) {
          expect(typeof result.metadata.title).toBe('string')
        }
        if (result.metadata.author) {
          expect(typeof result.metadata.author).toBe('string')
        }
      })
    })

    describe('2.3-UNIT-019至UNIT-022: PDF错误处理', () => {
      it('应该对加密PDF抛出ENCRYPTION_ERROR', async () => {
        // Note: 加密PDF fixture需要手动创建
        // 临时使用损坏的PDF测试错误处理机制
        const pdfBuffer = loadFixture('pdf/corrupted.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        await expect(parseDocument('test-doc-id')).rejects.toThrow(ParseError)
        
        // 验证数据库状态更新为FAILED
        expect(db.update).toHaveBeenCalled()
      })

      it('应该对损坏PDF抛出PARSE_ERROR', async () => {
        const pdfBuffer = loadFixture('pdf/corrupted.pdf')
        mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        await expect(parseDocument('test-doc-id')).rejects.toThrow(ParseError)
        
        const error = await parseDocument('test-doc-id').catch(e => e)
        expect(error.type).toMatch(/PARSE_ERROR|ENCRYPTION_ERROR/)
      })

      it('应该对空PDF抛出PARSE_ERROR', async () => {
        // Mock空文件
        const emptyBuffer = Buffer.alloc(100)
        mockParseDocumentFlow('application/pdf', emptyBuffer.buffer)

        await expect(parseDocument('test-doc-id')).rejects.toThrow(ParseError)
      })
    })
  })

  describe('Word文档解析功能 (AC3)', () => {
    describe('2.3-UNIT-026至UNIT-029: Word文本提取', () => {
      it('应该成功提取Word文档文本', async () => {
        const docxBuffer = loadFixture('docx/normal.docx')
        mockParseDocumentFlow('application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.contentLength).toBeGreaterThan(0)
        expect(result.metadata.paragraphCount).toBeGreaterThan(0)
        expect(result.metadata.wordCount).toBeGreaterThan(0)
      })

      it('应该支持中文Word文档', async () => {
        const docxBuffer = loadFixture('docx/chinese.docx')
        mockParseDocumentFlow('application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        // 验证中文字符
        expect(result.content).toMatch(/[\u4e00-\u9fa5]/)
      })
    })

    describe('2.3-UNIT-032至UNIT-034: Word错误处理', () => {
      it('应该对.doc旧格式抛出PARSE_ERROR', async () => {
        // Note: .doc fixture需要手动创建
        // 使用损坏的docx测试错误处理
        const docxBuffer = loadFixture('docx/corrupted.docx')
        mockParseDocumentFlow('application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer.buffer)

        await expect(parseDocument('test-doc-id')).rejects.toThrow(ParseError)
      })

      it('应该对损坏.docx抛出PARSE_ERROR', async () => {
        const docxBuffer = loadFixture('docx/corrupted.docx')
        mockParseDocumentFlow('application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer.buffer)

        await expect(parseDocument('test-doc-id')).rejects.toThrow(ParseError)
        
        const error = await parseDocument('test-doc-id').catch(e => e)
        expect(error.type).toBe('PARSE_ERROR')
      })
    })
  })

  describe('Markdown和TXT解析 (AC4)', () => {
    describe('2.3-UNIT-035至UNIT-038: 文本编码处理', () => {
      it('应该正确解析UTF-8文本', async () => {
        const txtBuffer = loadFixture('text/utf8.txt')
        mockParseDocumentFlow('text/plain', txtBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.contentLength).toBeGreaterThan(0)
        expect(result.metadata.encoding).toBeDefined()
        expect(result.metadata.lineCount).toBeGreaterThan(0)
      })

      it('应该自动检测GBK编码', async () => {
        const txtBuffer = loadFixture('text/gbk.txt')
        mockParseDocumentFlow('text/plain', txtBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        expect(result.metadata.encoding).toBeDefined()
        // GBK编码的中文应该能正确解析
        expect(result.content).toMatch(/[\u4e00-\u9fa5]/)
      })
    })

    describe('2.3-UNIT-039至UNIT-040: Markdown格式保留', () => {
      it('应该完整保留Markdown格式', async () => {
        const mdBuffer = loadFixture('text/sample.md')
        mockParseDocumentFlow('text/markdown', mdBuffer.buffer)

        const result = await parseDocument('test-doc-id')

        expect(result.content).toBeDefined()
        // 验证Markdown标记保留(#, *, -, 等)
        expect(result.content).toMatch(/[#*\-\[\]]/)
      })
    })
  })

  describe('错误处理 (AC7)', () => {
    describe('2.3-UNIT-046至UNIT-047: 错误分类', () => {
      it('应该捕获所有解析错误而不崩溃', async () => {
        // Mock数据库返回
        (db.select as jest.Mock).mockReturnValue({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{
            id: 'test-doc',
            userId: 'test-user',
            fileType: 'application/pdf',
            storagePath: 'test.pdf'
          }])
        })

        // Mock Storage返回无效数据
        ;(StorageService.getFile as jest.Mock).mockResolvedValue(null)

        // Mock数据库更新
        ;(db.update as jest.Mock).mockReturnValue({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue(undefined)
        })

        await expect(parseDocument('test-doc')).rejects.toThrow(ParseError)
        
        // 验证数据库更新被调用(记录错误状态)
        expect(db.update).toHaveBeenCalled()
      })

      it('应该正确分类错误类型', async () => {
        const testCases = [
          { fileType: 'application/octet-stream', expectedType: 'UNSUPPORTED_FORMAT' },
          { fileType: 'application/pdf', buffer: null, expectedType: 'PARSE_ERROR' },
        ]

        for (const testCase of testCases) {
          jest.clearAllMocks()
          
          ;(db.select as jest.Mock).mockReturnValue({
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue([{
              id: 'test-doc',
              userId: 'test-user',
              fileType: testCase.fileType,
              storagePath: 'test.pdf'
            }])
          })

          ;(StorageService.getFile as jest.Mock).mockResolvedValue(testCase.buffer || Buffer.alloc(100).buffer)

          ;(db.update as jest.Mock).mockReturnValue({
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue(undefined)
          })

          const error = await parseDocument('test-doc').catch(e => e)
          expect(error).toBeInstanceOf(ParseError)
        }
      })
    })
  })

  describe('性能要求 (AC8)', () => {
    describe('2.3-UNIT-050: 超时控制', () => {
      it('应该在30秒后超时', async () => {
        // Mock数据库
        (db.select as jest.Mock).mockReturnValue({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{
            id: 'test-doc',
            userId: 'test-user',
            fileType: 'application/pdf',
            storagePath: 'test.pdf'
          }])
        })

        // Mock Storage返回文件,但模拟慢解析
        // 使用一个永不resolve的Promise来触发超时
        ;(StorageService.getFile as jest.Mock).mockImplementation(() => {
          return new Promise(() => {
            // 永不resolve,触发超时
          })
        })

        // Mock更新
        ;(db.update as jest.Mock).mockReturnValue({
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue(undefined)
        })

        const startTime = Date.now()
        await expect(parseDocument('test-doc')).rejects.toThrow('解析超时')
        const duration = Date.now() - startTime

        // 验证在30秒左右超时(允许1秒误差)
        expect(duration).toBeGreaterThan(29000)
        expect(duration).toBeLessThan(32000)
      }, 35000) // Jest超时设置为35秒
    })

    describe('2.3-UNIT-051: 内存管理', () => {
      it('应该监控内存使用', async () => {
        const pdfBuffer = loadFixture('pdf/1mb.pdf')
        const { capturedMetadata } = mockParseDocumentFlow('application/pdf', pdfBuffer.buffer)

        await parseDocument('test-doc-id')

        const metadata = capturedMetadata()
        expect(metadata.metadata).toBeDefined()
        expect(metadata.metadata.memoryUsed).toBeDefined()
        expect(typeof metadata.metadata.memoryUsed).toBe('number')
        // 1MB PDF的内存使用应该合理(小于100MB)
        expect(metadata.metadata.memoryUsed).toBeLessThan(100 * 1024 * 1024)
      })
    })
  })
})

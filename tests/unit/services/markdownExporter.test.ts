// tests/unit/services/markdownExporter.test.ts
import { generateMarkdownExport } from '@/services/export/markdownExporter'
import type { ConversationExportData } from '@/services/export/markdownExporter'

describe('markdownExporter', () => {
  const mockData: ConversationExportData = {
    id: 'conv-123',
    title: '测试对话',
    documentName: '测试文档.pdf',
    createdAt: new Date('2025-01-08T10:00:00'),
    messages: [
      {
        id: 'msg-1',
        role: 'USER',
        content: '这是一个问题？',
        createdAt: new Date('2025-01-08T10:01:00')
      },
      {
        id: 'msg-2',
        role: 'ASSISTANT',
        content: '这是一个回答。',
        citations: [
          {
            id: 'cit-1',
            documentName: '测试文档.pdf',
            pageNumber: 1,
            quoteText: '引用文本',
            relevanceScore: 0.95
          }
        ],
        createdAt: new Date('2025-01-08T10:02:00')
      }
    ]
  }

  it('should generate valid markdown', async () => {
    const buffer = await generateMarkdownExport(mockData)
    const markdown = buffer.toString('utf-8')

    expect(markdown).toContain('# 对话: 测试对话')
    expect(markdown).toContain('**关联文档**: 测试文档.pdf')
    expect(markdown).toContain('## Q: 这是一个问题？')
    expect(markdown).toContain('这是一个回答。')
  })

  it('should include citations when present', async () => {
    const buffer = await generateMarkdownExport(mockData)
    const markdown = buffer.toString('utf-8')

    expect(markdown).toContain('**引用来源**')
    expect(markdown).toContain('[1] 测试文档.pdf - 第1页')
  })

  it('should handle messages without citations', async () => {
    const dataWithoutCitations: ConversationExportData = {
      ...mockData,
      messages: [
        {
          id: 'msg-1',
          role: 'USER',
          content: '问题',
          createdAt: new Date()
        },
        {
          id: 'msg-2',
          role: 'ASSISTANT',
          content: '回答',
          createdAt: new Date()
        }
      ]
    }

    const buffer = await generateMarkdownExport(dataWithoutCitations)
    const markdown = buffer.toString('utf-8')

    expect(markdown).not.toContain('**引用来源**')
    expect(markdown).toContain('## Q: 问题')
    expect(markdown).toContain('回答')
  })

  it('should include metadata', async () => {
    const buffer = await generateMarkdownExport(mockData)
    const markdown = buffer.toString('utf-8')

    expect(markdown).toContain('**创建时间**:')
    expect(markdown).toContain('**导出时间**:')
    expect(markdown).toContain('**系统**: DocQA System v1.0')
  })
})

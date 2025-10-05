/**
 * ChunkingService 单元测试
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { chunkDocument, ChunkingError } from '@/services/documents/chunkingService'
import { db } from '@/lib/db'
import { documents, documentChunks } from '@/drizzle/schema'

// Mock dependencies
jest.mock('@/lib/db')
jest.mock('@langchain/textsplitters')

describe('ChunkingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('chunkDocument', () => {
    it('应该成功分块文档', async () => {
      // Mock database responses
      const mockDocument = {
        id: 'test-doc-id',
        status: 'READY',
        metadata: {
          content: '这是一个测试文档。'.repeat(100) // 足够长的内容
        }
      }

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockDocument])
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      const mockInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { id: 'chunk-1', chunkIndex: 0, content: '测试内容', length: 4 }
          ])
        })
      })

      ;(db.select as jest.Mock) = mockSelect
      ;(db.update as jest.Mock) = mockUpdate
      ;(db.insert as jest.Mock) = mockInsert

      // TODO: 实际测试需要正确mock RecursiveCharacterTextSplitter
      // const result = await chunkDocument('test-doc-id')
      // expect(result).toHaveLength(1)
      // expect(result[0].chunkIndex).toBe(0)
    })

    it('应该在文档不存在时抛出错误', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      })

      ;(db.select as jest.Mock) = mockSelect

      await expect(chunkDocument('non-existent-id')).rejects.toThrow(ChunkingError)
    })

    it('应该在文档状态不正确时抛出错误', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        status: 'PENDING',
        metadata: {}
      }

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockDocument])
        })
      })

      ;(db.select as jest.Mock) = mockSelect

      await expect(chunkDocument('test-doc-id')).rejects.toThrow('文档状态错误')
    })

    it('应该在内容为空时抛出错误', async () => {
      const mockDocument = {
        id: 'test-doc-id',
        status: 'READY',
        metadata: {}
      }

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockDocument])
        })
      })

      const mockUpdate = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      ;(db.select as jest.Mock) = mockSelect
      ;(db.update as jest.Mock) = mockUpdate

      await expect(chunkDocument('test-doc-id')).rejects.toThrow('文档未解析或内容为空')
    })
  })
})

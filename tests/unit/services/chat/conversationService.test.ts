/**
 * ConversationService单元测试
 * Story 3.3: LLM回答生成与流式输出
 */

import { conversationService } from '@/services/chat/conversationService'
import { db } from '@/lib/db'
import { conversations, messages } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

// Mock数据库
jest.mock('@/lib/db', () => ({
  db: {
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn()
      }))
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn()
        }))
      }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn()
      }))
    })),
    $count: jest.fn()
  }
}))

jest.mock('@/drizzle/schema', () => ({
  conversations: {},
  messages: {}
}))

describe('ConversationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createConversation', () => {
    it('应该创建新对话', async () => {
      const mockConversation = {
        id: 'test-conv-id',
        userId: 'user-1',
        documentId: 'doc-1',
        title: '新对话',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockConversation])
        })
      })

      const result = await conversationService.createConversation(
        'user-1',
        'doc-1'
      )

      expect(result).toBeDefined()
      expect(db.insert).toHaveBeenCalled()
    })

    it('应该使用自定义标题创建对话', async () => {
      const mockConversation = {
        id: 'test-conv-id',
        userId: 'user-1',
        documentId: 'doc-1',
        title: '自定义标题',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockConversation])
        })
      })

      const result = await conversationService.createConversation(
        'user-1',
        'doc-1',
        '自定义标题'
      )

      expect(result).toBeDefined()
    })
  })

  describe('getConversation', () => {
    it('应该获取对话详情', async () => {
      const mockConversation = {
        id: 'test-conv-id',
        userId: 'user-1',
        documentId: 'doc-1',
        title: '测试对话',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockConversation])
        })
      })

      const result = await conversationService.getConversation(
        'test-conv-id',
        'user-1'
      )

      expect(result).toBeDefined()
      expect(result.id).toBe('test-conv-id')
    })

    it('应该在对话不存在时抛出错误', async () => {
      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      })

      await expect(
        conversationService.getConversation('non-existent', 'user-1')
      ).rejects.toThrow('CONVERSATION_NOT_FOUND')
    })
  })

  describe('createUserMessage', () => {
    it('应该创建用户消息', async () => {
      const mockMessage = {
        id: 'msg-id',
        conversationId: 'conv-id',
        role: 'USER',
        content: '用户问题',
        citations: null,
        tokenCount: 0,
        createdAt: new Date()
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockMessage])
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      const result = await conversationService.createUserMessage(
        'conv-id',
        '用户问题'
      )

      expect(result).toBeDefined()
      expect(db.insert).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()
    })
  })

  describe('createAssistantMessage', () => {
    it('应该创建AI助手消息', async () => {
      const mockMessage = {
        id: 'msg-id',
        conversationId: 'conv-id',
        role: 'ASSISTANT',
        content: 'AI回答',
        citations: null,
        tokenCount: 0,
        createdAt: new Date()
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockMessage])
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      const result = await conversationService.createAssistantMessage(
        'conv-id',
        'AI回答'
      )

      expect(result).toBeDefined()
      expect(db.insert).toHaveBeenCalled()
    })

    it('应该支持引用数据', async () => {
      const mockMessage = {
        id: 'msg-id',
        conversationId: 'conv-id',
        role: 'ASSISTANT',
        content: 'AI回答',
        citations: [{ id: '1', text: '引用' }],
        tokenCount: 0,
        createdAt: new Date()
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockMessage])
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      const result = await conversationService.createAssistantMessage(
        'conv-id',
        'AI回答',
        [{ id: '1', text: '引用' }]
      )

      expect(result).toBeDefined()
    })
  })
})

/**
 * AnswerService 单元测试
 * Story 4.4: AnswerService 单元测试
 * 
 * 覆盖率目标:
 * - 行覆盖率 ≥ 90%
 * - 分支覆盖率 ≥ 85%
 * - 函数覆盖率 = 100%
 */

import { AnswerService } from '@/services/rag/answerService'

// ==================== Mock Setup ====================

// Mock LLMRepositoryFactory
const mockStreamChatCompletion = jest.fn()
jest.mock('@/infrastructure/llm/llm-repository.factory', () => ({
  LLMRepositoryFactory: {
    create: jest.fn(() => ({
      streamChatCompletion: (...args: any[]) => mockStreamChatCompletion(...args)
    }))
  }
}))

// Mock conversationService
const mockGetConversationHistory = jest.fn()
jest.mock('@/services/chat/conversationService', () => ({
  conversationService: {
    getConversationHistory: (...args: any[]) => mockGetConversationHistory(...args)
  }
}))

// Mock promptBuilder
const mockBuildSystemPrompt = jest.fn()
const mockTruncateContext = jest.fn()
const mockEstimateTokenCount = jest.fn()
jest.mock('@/services/rag/promptBuilder', () => ({
  buildSystemPrompt: (...args: any[]) => mockBuildSystemPrompt(...args),
  truncateContext: (...args: any[]) => mockTruncateContext(...args),
  estimateTokenCount: (...args: any[]) => mockEstimateTokenCount(...args)
}))

// ==================== Test Data ====================

const mockRetrieval = {
  chunks: [
    {
      id: 'chunk-1',
      content: 'This is the first chunk about AI.',
      score: 0.85,
      chunkIndex: 0,
      metadata: { pageNumber: 1 }
    },
    {
      id: 'chunk-2',
      content: 'This is the second chunk about machine learning.',
      score: 0.75,
      chunkIndex: 1,
      metadata: { pageNumber: 2 }
    }
  ],
  totalFound: 2,
  cached: false,
  retrievalTime: 100
}

const mockHistory = [
  { role: 'USER', content: 'Hello' },
  { role: 'ASSISTANT', content: 'Hi there!' },
  { role: 'USER', content: 'How are you?' },
  { role: 'ASSISTANT', content: 'I am fine, thank you!' }
]

const mockSystemPrompt = 'You are a helpful assistant.'
const mockTruncatedChunks = mockRetrieval.chunks

// ==================== Tests ====================

describe('AnswerService', () => {
  let service: AnswerService

  beforeEach(() => {
    // 清理所有mocks
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
    
    // 默认Mock配置
    mockBuildSystemPrompt.mockReturnValue(mockSystemPrompt)
    mockTruncateContext.mockReturnValue(mockTruncatedChunks)
    mockEstimateTokenCount.mockImplementation((text: string) => Math.ceil(text.length / 4))
    
    // 创建服务实例
    service = new AnswerService()
  })

  // ==================== AC1, AC2, AC4: 正常流程测试 ====================
  describe('generateAnswer - 正常流程', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    it('测试1: 应该返回流式文本chunks', async () => {
      // Mock流式生成器
      async function* mockGenerator() {
        yield 'Hello'
        yield ' '
        yield 'World'
        yield '!'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      // 收集所有chunks
      const chunks: string[] = []
      for await (const chunk of service.generateAnswer('test query', mockRetrieval, null)) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Hello', ' ', 'World', '!'])
      expect(chunks.join('')).toBe('Hello World!')
    })

    it('测试2: 应该评估问题复杂度（simple）', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      // 简单问题：短且无复杂关键词
      const simpleQuery = '什么是AI'
      
      for await (const _ of service.generateAnswer(simpleQuery, mockRetrieval, null)) {}

      expect(consoleSpy).toHaveBeenCalled()
      const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
      expect(logCall).toBeDefined()
      expect(logCall[1].complexity).toBe('simple')

      consoleSpy.mockRestore()
    })

    it('测试3: 应该评估问题复杂度（complex）', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      // 复杂问题：包含关键词"分析"
      const complexQuery = '请分析AI的发展趋势'
      
      for await (const _ of service.generateAnswer(complexQuery, mockRetrieval, null)) {}

      const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
      expect(logCall[1].complexity).toBe('complex')

      consoleSpy.mockRestore()
    })

    it('测试4: 应该截断上下文到2000 tokens', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      // 验证调用了truncateContext，参数为chunks和2000
      expect(mockTruncateContext).toHaveBeenCalledWith(mockRetrieval.chunks, 2000)
    })

    it('测试5: 应该构建System Prompt', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      // 验证调用了buildSystemPrompt
      expect(mockBuildSystemPrompt).toHaveBeenCalledWith(mockTruncatedChunks)
    })

    it('测试6: 应该包含对话历史（includeHistory=true）', async () => {
      mockGetConversationHistory.mockResolvedValue(mockHistory)
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test query',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      // 验证加载了历史
      expect(mockGetConversationHistory).toHaveBeenCalledWith('conv-123', 10)
      
      // 验证messages包含历史
      expect(mockStreamChatCompletion).toHaveBeenCalled()
      const messages = mockStreamChatCompletion.mock.calls[0][0]
      
      // 应该有 system + 4条历史 + user = 6条消息
      expect(messages.length).toBe(6)
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('Hello')
      expect(messages[2].role).toBe('assistant')
      expect(messages[2].content).toBe('Hi there!')
    })

    it('测试7: 应该按正确顺序构建messages：[system, ...history, user]', async () => {
      mockGetConversationHistory.mockResolvedValue(mockHistory)
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      const userQuery = 'What is AI?'
      for await (const _ of service.generateAnswer(
        userQuery,
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      const messages = mockStreamChatCompletion.mock.calls[0][0]
      
      // 验证顺序
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe(mockSystemPrompt)
      
      // 历史消息
      expect(messages[1].role).toBe('user')
      expect(messages[2].role).toBe('assistant')
      expect(messages[3].role).toBe('user')
      expect(messages[4].role).toBe('assistant')
      
      // 最后是用户查询
      expect(messages[5].role).toBe('user')
      expect(messages[5].content).toBe(userQuery)
    })
  })

  // ==================== AC3: 历史截断逻辑测试 ====================
  describe('generateAnswer - 历史截断', () => {
    it('测试8: 应该加载最近10条历史', async () => {
      mockGetConversationHistory.mockResolvedValue(mockHistory)
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      // 验证请求了10条历史
      expect(mockGetConversationHistory).toHaveBeenCalledWith('conv-123', 10)
    })

    it('测试9: 应该转换历史格式（USER→user, ASSISTANT→assistant）', async () => {
      mockGetConversationHistory.mockResolvedValue(mockHistory)
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      const messages = mockStreamChatCompletion.mock.calls[0][0]
      
      // 验证转换后的格式（跳过system消息）
      const historyMessages = messages.slice(1, -1)
      expect(historyMessages[0].role).toBe('user') // USER -> user
      expect(historyMessages[1].role).toBe('assistant') // ASSISTANT -> assistant
    })

    it('测试10: 应该在Prompt过长时截断历史的一半', async () => {
      // 创建长历史
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'USER' : 'ASSISTANT',
        content: 'A'.repeat(200) // 每条消息很长
      }))
      
      mockGetConversationHistory.mockResolvedValue(longHistory)
      
      // Mock estimateTokenCount 返回高值，使Prompt超长
      mockEstimateTokenCount.mockImplementation((text: string) => {
        return text.length * 2 // 故意高估
      })
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      // 验证历史被截断
      const messages = mockStreamChatCompletion.mock.calls[0][0]
      const historyCount = messages.length - 2 // 减去system和user
      
      // 应该少于原始历史数量（被截断了一半）
      expect(historyCount).toBeLessThan(longHistory.length)
      expect(historyCount).toBe(Math.floor(longHistory.length / 2))
    })

    it('测试11: 历史加载失败应该继续执行（不中断）', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      mockGetConversationHistory.mockRejectedValue(new Error('Database error'))
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      // 应该成功完成，不抛出错误
      const chunks: string[] = []
      for await (const chunk of service.generateAnswer(
        'test',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['answer'])
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load conversation history:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  // ==================== AC5: 超时控制测试 ====================
  describe('generateAnswer - 超时控制', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    // 注意：超时控制的详细逻辑测试（首字节5秒，总体30秒）很难在单元测试中模拟
    // 因为涉及真实时间流逝。这里我们测试超时错误能被正确识别和处理。
    // 实际的超时阈值验证应该在集成测试或E2E测试中完成。

    it('测试12/13: 应该识别并转换timeout错误为GENERATION_TIMEOUT', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // 模拟LLM抛出timeout错误
      async function* timeoutGenerator() {
        throw new Error('Request timeout after 30 seconds')
      }
      mockStreamChatCompletion.mockReturnValue(timeoutGenerator())

      await expect(async () => {
        for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}
      }).rejects.toThrow('GENERATION_TIMEOUT')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Answer generation failed',
        expect.objectContaining({
          error: expect.stringContaining('timeout'),
          elapsed: expect.stringContaining('ms')
        })
      )

      consoleErrorSpy.mockRestore()
    })

    it('测试14: 正常情况下不超时', async () => {
      // 快速生成器
      async function* fastGenerator() {
        yield 'fast'
        yield 'response'
      }
      mockStreamChatCompletion.mockReturnValue(fastGenerator())

      const chunks: string[] = []
      // 应该正常完成，不抛出超时错误
      for await (const chunk of service.generateAnswer('test', mockRetrieval, null)) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['fast', 'response'])
    })
  })

  // ==================== AC6: 错误处理测试 ====================
  describe('generateAnswer - 错误处理', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    it('测试15: timeout错误应该转换为GENERATION_TIMEOUT', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock抛出timeout错误
      async function* errorGenerator() {
        throw new Error('Request timeout after 30s')
      }
      mockStreamChatCompletion.mockReturnValue(errorGenerator())

      await expect(async () => {
        for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}
      }).rejects.toThrow('GENERATION_TIMEOUT')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Answer generation failed',
        expect.objectContaining({
          error: expect.stringContaining('timeout')
        })
      )

      consoleErrorSpy.mockRestore()
    })

    it('测试16: quota错误应该转换为QUOTA_EXCEEDED', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock抛出quota错误
      async function* errorGenerator() {
        throw new Error('API quota exceeded')
      }
      mockStreamChatCompletion.mockReturnValue(errorGenerator())

      await expect(async () => {
        for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}
      }).rejects.toThrow('QUOTA_EXCEEDED')

      consoleErrorSpy.mockRestore()
    })

    it('测试17: 其他错误应该转换为GENERATION_ERROR', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock抛出通用错误
      async function* errorGenerator() {
        throw new Error('Network error')
      }
      mockStreamChatCompletion.mockReturnValue(errorGenerator())

      await expect(async () => {
        for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}
      }).rejects.toThrow('GENERATION_ERROR')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Answer generation failed',
        expect.objectContaining({
          error: 'Network error',
          elapsed: expect.stringContaining('ms')
        })
      )

      consoleErrorSpy.mockRestore()
    })
  })

  // ==================== AC7: 边界情况测试 ====================
  describe('generateAnswer - 边界情况', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    it('测试18: 应该处理空历史', async () => {
      mockGetConversationHistory.mockResolvedValue([])
      
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        'conv-123',
        { includeHistory: true }
      )) {}

      const messages = mockStreamChatCompletion.mock.calls[0][0]
      
      // 应该只有 system + user = 2条消息
      expect(messages.length).toBe(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })

    it('测试19: 应该处理非常长的查询（>1000字符）', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      const longQuery = 'A'.repeat(1500)
      
      const chunks: string[] = []
      for await (const chunk of service.generateAnswer(longQuery, mockRetrieval, null)) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['answer'])
      
      // 验证长查询被传递到streamChatCompletion
      const messages = mockStreamChatCompletion.mock.calls[0][0]
      expect(messages[messages.length - 1].content).toBe(longQuery)
    })

    it('测试20: 应该处理特殊字符（中文、Emoji）', async () => {
      async function* mockGenerator() {
        yield '你好'
        yield '😊'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      const specialQuery = '什么是AI？🤖'
      
      const chunks: string[] = []
      for await (const chunk of service.generateAnswer(specialQuery, mockRetrieval, null)) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['你好', '😊'])
      
      // 验证特殊字符查询被正确传递
      const messages = mockStreamChatCompletion.mock.calls[0][0]
      expect(messages[messages.length - 1].content).toBe(specialQuery)
    })

    it('测试21: 应该处理空检索结果（chunks=[]）', async () => {
      const emptyRetrieval = {
        ...mockRetrieval,
        chunks: []
      }
      
      mockTruncateContext.mockReturnValue([])
      mockBuildSystemPrompt.mockReturnValue('System prompt with no context')
      
      async function* mockGenerator() {
        yield '根据提供的文档无法回答该问题'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      const chunks: string[] = []
      for await (const chunk of service.generateAnswer('test', emptyRetrieval, null)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(mockTruncateContext).toHaveBeenCalledWith([], 2000)
      expect(mockBuildSystemPrompt).toHaveBeenCalledWith([])
    })
  })

  // ==================== 其他功能测试 ====================
  describe('generateAnswer - 流式生成详细测试', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    it('应该统计totalChunks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      async function* mockGenerator() {
        yield 'chunk1'
        yield 'chunk2'
        yield 'chunk3'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
      expect(logCall[1].totalChunks).toBe(3)

      consoleSpy.mockRestore()
    })

    it('应该记录firstChunkLatency', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      async function* mockGenerator() {
        yield 'chunk1'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
      expect(logCall[1].firstChunkLatency).toMatch(/\d+ms/)

      consoleSpy.mockRestore()
    })

    it('应该记录总elapsed时间', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      async function* mockGenerator() {
        yield 'chunk'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
      expect(logCall[1].elapsed).toMatch(/\d+ms/)

      consoleSpy.mockRestore()
    })
  })

  describe('generateAnswer - 选项参数测试', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    it('应该使用自定义temperature参数', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        null,
        { temperature: 0.5 }
      )) {}

      expect(mockStreamChatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.5
        })
      )
    })

    it('应该使用自定义maxTokens参数', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      for await (const _ of service.generateAnswer(
        'test',
        mockRetrieval,
        null,
        { maxTokens: 1000 }
      )) {}

      expect(mockStreamChatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxTokens: 1000
        })
      )
    })

    it('应该使用默认参数（temperature=0.1）和动态 maxTokens', async () => {
      async function* mockGenerator() {
        yield 'answer'
      }
      mockStreamChatCompletion.mockReturnValue(mockGenerator())

      // 简单问题应该使用动态计算的 300
      for await (const _ of service.generateAnswer('test', mockRetrieval, null)) {}

      expect(mockStreamChatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 300,  // 动态计算：简单问题使用 300
          topP: 0.9
        })
      )
    })
  })

  // ==================== Story 4.9: 动态 maxTokens 测试 ====================
  describe('Story 4.9 - Dynamic maxTokens', () => {
    beforeEach(() => {
      mockGetConversationHistory.mockResolvedValue([])
    })

    describe('calculateMaxTokens', () => {
      it('应该为简单问题返回 300', () => {
        const maxTokens = service['calculateMaxTokens']('simple')
        expect(maxTokens).toBe(300)
      })
      
      it('应该为复杂问题返回 500', () => {
        const maxTokens = service['calculateMaxTokens']('complex')
        expect(maxTokens).toBe(500)
      })
    })
    
    describe('assessComplexity - Enhanced', () => {
      it('应该识别简单问题', () => {
        expect(service['assessComplexity']('什么是Redis?')).toBe('simple')
        expect(service['assessComplexity']('定义微服务')).toBe('simple')
        expect(service['assessComplexity']('AI是什么')).toBe('simple')
      })
      
      it('应该识别复杂问题 - 关键词', () => {
        expect(service['assessComplexity']('详细分析Redis的优缺点')).toBe('complex')
        expect(service['assessComplexity']('对比Redis和Memcached')).toBe('complex')
        expect(service['assessComplexity']('如何实现微服务')).toBe('complex')
        expect(service['assessComplexity']('为什么选择TypeScript')).toBe('complex')
        expect(service['assessComplexity']('解释Docker原理')).toBe('complex')
      })
      
      it('应该识别复杂问题 - 长度', () => {
        const longQuery = '在微服务架构中，如何确保数据一致性和服务间通信的可靠性，同时还要保证系统的高可用性？'
        expect(service['assessComplexity'](longQuery)).toBe('complex')
        expect(longQuery.length).toBeGreaterThan(40)
      })
      
      it('应该识别复杂问题 - 多个问号', () => {
        const multiQuestion = '什么是Docker？它解决了什么问题？'
        expect(service['assessComplexity'](multiQuestion)).toBe('complex')
        
        const multiQuestionEn = 'What is Docker? What problems does it solve?'
        expect(service['assessComplexity'](multiQuestionEn)).toBe('complex')
      })
      
      it('应该识别复杂问题 - 包含列表', () => {
        expect(service['assessComplexity']('请列举：1. Redis的特点')).toBe('complex')
        expect(service['assessComplexity']('包括以下内容：一、基础知识')).toBe('complex')
        expect(service['assessComplexity']('分为几个部分：• 第一部分')).toBe('complex')
      })

      it('应该正确处理边界情况 - 正好40字符', () => {
        const exactly40 = 'A'.repeat(40)
        expect(exactly40.length).toBe(40)
        expect(service['assessComplexity'](exactly40)).toBe('simple')
        
        const exactly41 = 'A'.repeat(41)
        expect(exactly41.length).toBe(41)
        expect(service['assessComplexity'](exactly41)).toBe('complex')
      })

      it('应该正确处理边界情况 - 只有一个问号', () => {
        expect(service['assessComplexity']('什么是AI？')).toBe('simple')
        expect(service['assessComplexity']('What is AI?')).toBe('simple')
      })
    })
    
    describe('generateAnswer - Dynamic maxTokens Integration', () => {
      it('应该为简单问题使用 300 maxTokens', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        async function* mockGenerator() {
          yield 'test'
        }
        mockStreamChatCompletion.mockReturnValue(mockGenerator())
        
        const simpleQuery = "什么是Redis?"
        
        for await (const _ of service.generateAnswer(
          simpleQuery,
          mockRetrieval,
          null
        )) {}
        
        // 验证 LLM 调用参数
        expect(mockStreamChatCompletion).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            maxTokens: 300  // ✅ 简单问题使用 300
          })
        )

        // 验证日志
        const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Dynamic token allocation')
        expect(logCall).toBeDefined()
        expect(logCall[1]).toMatchObject({
          complexity: 'simple',
          dynamicMaxTokens: 300,
          userSpecified: undefined,
          finalMaxTokens: 300
        })

        consoleSpy.mockRestore()
      })
      
      it('应该为复杂问题使用 500 maxTokens', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        async function* mockGenerator() {
          yield 'test'
        }
        mockStreamChatCompletion.mockReturnValue(mockGenerator())
        
        const complexQuery = "详细分析Redis和Memcached的优缺点"
        
        for await (const _ of service.generateAnswer(
          complexQuery,
          mockRetrieval,
          null
        )) {}
        
        expect(mockStreamChatCompletion).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            maxTokens: 500  // ✅ 复杂问题使用 500
          })
        )

        // 验证日志
        const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Dynamic token allocation')
        expect(logCall[1]).toMatchObject({
          complexity: 'complex',
          dynamicMaxTokens: 500,
          userSpecified: undefined,
          finalMaxTokens: 500
        })

        consoleSpy.mockRestore()
      })
      
      it('应该优先使用用户指定的 maxTokens', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        async function* mockGenerator() {
          yield 'test'
        }
        mockStreamChatCompletion.mockReturnValue(mockGenerator())
        
        const simpleQuery = "什么是Redis?"
        
        for await (const _ of service.generateAnswer(
          simpleQuery,
          mockRetrieval,
          null,
          { maxTokens: 800 }  // 用户指定
        )) {}
        
        expect(mockStreamChatCompletion).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            maxTokens: 800  // ✅ 使用用户指定值
          })
        )

        // 验证日志显示了覆盖逻辑
        const logCall = consoleSpy.mock.calls.find(call => call[0] === 'Dynamic token allocation')
        expect(logCall[1]).toMatchObject({
          complexity: 'simple',
          dynamicMaxTokens: 300,  // 动态计算的值
          userSpecified: 800,      // 用户指定的值
          finalMaxTokens: 800      // 最终使用用户指定的值
        })

        consoleSpy.mockRestore()
      })

      it('应该在完成日志中包含 tokens 信息', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        async function* mockGenerator() {
          yield 'answer'
        }
        mockStreamChatCompletion.mockReturnValue(mockGenerator())

        const simpleQuery = "什么是AI?"
        
        for await (const _ of service.generateAnswer(
          simpleQuery,
          mockRetrieval,
          null
        )) {}

        // 验证完成日志包含新字段
        const completionLog = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
        expect(completionLog).toBeDefined()
        expect(completionLog[1]).toMatchObject({
          complexity: 'simple',
          dynamicMaxTokens: 300,
          userSpecifiedMaxTokens: undefined,
          finalMaxTokens: 300,
          provider: expect.any(String),
          elapsed: expect.stringMatching(/\d+ms/),
          firstChunkLatency: expect.stringMatching(/\d+ms/),
          totalChunks: 1,
          queryLength: expect.any(Number),
          chunksUsed: expect.any(Number)
        })

        consoleSpy.mockRestore()
      })

      it('应该为复杂问题正确记录所有 tokens 信息', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        async function* mockGenerator() {
          yield 'detailed'
          yield ' '
          yield 'answer'
        }
        mockStreamChatCompletion.mockReturnValue(mockGenerator())

        const complexQuery = "请详细对比TypeScript和JavaScript的优缺点，并说明适用场景"
        
        for await (const _ of service.generateAnswer(
          complexQuery,
          mockRetrieval,
          null
        )) {}

        // 验证动态分配日志
        const allocationLog = consoleSpy.mock.calls.find(call => call[0] === 'Dynamic token allocation')
        expect(allocationLog[1]).toMatchObject({
          complexity: 'complex',
          dynamicMaxTokens: 500,
          userSpecified: undefined,
          finalMaxTokens: 500
        })

        // 验证完成日志
        const completionLog = consoleSpy.mock.calls.find(call => call[0] === 'Answer generation completed')
        expect(completionLog[1]).toMatchObject({
          complexity: 'complex',
          dynamicMaxTokens: 500,
          userSpecifiedMaxTokens: undefined,
          finalMaxTokens: 500,
          totalChunks: 3
        })

        consoleSpy.mockRestore()
      })
    })
  })
})


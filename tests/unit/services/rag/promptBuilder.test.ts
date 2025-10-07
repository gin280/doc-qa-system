/**
 * Prompt Builder单元测试
 * Story 3.3: LLM回答生成与流式输出
 */

import {
  buildSystemPrompt,
  estimateTokenCount,
  truncateContext,
  validatePromptLength
} from '@/services/rag/promptBuilder'

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it('应该构建正确格式的System Prompt', () => {
      const chunks = [
        {
          id: '1',
          content: '第一段内容',
          score: 0.9,
          chunkIndex: 0
        },
        {
          id: '2',
          content: '第二段内容',
          score: 0.8,
          chunkIndex: 1
        }
      ]

      const prompt = buildSystemPrompt(chunks)

      expect(prompt).toContain('[1] 第一段内容')
      expect(prompt).toContain('[2] 第二段内容')
      expect(prompt).toContain('只使用提供的文档内容回答')
      expect(prompt).toContain('使用[1][2]等编号标注引用来源')
    })

    it('应该处理空chunks数组', () => {
      const prompt = buildSystemPrompt([])

      expect(prompt).toContain('文档内容')
      // 空chunks时，文档内容部分应该是空的（只有标题）
      expect(prompt).toContain('## 文档内容：')
    })
  })

  describe('estimateTokenCount', () => {
    it('应该估算中文文本的Token数量', () => {
      const text = '这是一段中文测试文本，包含大约二十个字'
      const tokens = estimateTokenCount(text)

      // 中文约1 token ≈ 4个字符
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 4) + 1)
    })

    it('应该估算英文文本的Token数量', () => {
      const text = 'This is a test sentence with multiple words'
      const tokens = estimateTokenCount(text)

      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 4) + 1)
    })

    it('应该处理空字符串', () => {
      const tokens = estimateTokenCount('')
      expect(tokens).toBe(0)
    })
  })

  describe('truncateContext', () => {
    it('应该截断超过限制的上下文', () => {
      const chunks = [
        { id: '1', content: 'A'.repeat(1000), score: 0.9, chunkIndex: 0 },
        { id: '2', content: 'B'.repeat(1000), score: 0.8, chunkIndex: 1 },
        { id: '3', content: 'C'.repeat(1000), score: 0.7, chunkIndex: 2 }
      ]

      // 限制为500 tokens（约2000字符）
      const truncated = truncateContext(chunks, 500)

      // 应该只保留前2个chunks
      expect(truncated.length).toBeLessThanOrEqual(2)
      expect(truncated[0].id).toBe('1')
    })

    it('应该保留所有chunks如果未超过限制', () => {
      const chunks = [
        { id: '1', content: '短内容1', score: 0.9, chunkIndex: 0 },
        { id: '2', content: '短内容2', score: 0.8, chunkIndex: 1 }
      ]

      const truncated = truncateContext(chunks, 2000)

      expect(truncated.length).toBe(2)
    })

    it('应该处理空数组', () => {
      const truncated = truncateContext([], 2000)
      expect(truncated).toEqual([])
    })
  })

  describe('validatePromptLength', () => {
    it('应该验证Prompt长度在限制内', () => {
      const systemPrompt = '简短的系统提示'
      const userMessage = '用户问题'
      const history = [
        { role: 'user', content: '历史问题' },
        { role: 'assistant', content: '历史回答' }
      ]

      const result = validatePromptLength(systemPrompt, userMessage, history)

      expect(result.valid).toBe(true)
      expect(result.totalTokens).toBeGreaterThan(0)
      expect(result.maxTokens).toBe(3000)
    })

    it('应该检测超过限制的Prompt', () => {
      const systemPrompt = 'A'.repeat(10000)
      const userMessage = 'B'.repeat(2000)
      const history = [
        { role: 'user', content: 'C'.repeat(2000) },
        { role: 'assistant', content: 'D'.repeat(2000) }
      ]

      const result = validatePromptLength(systemPrompt, userMessage, history)

      expect(result.valid).toBe(false)
      expect(result.totalTokens).toBeGreaterThan(result.maxTokens)
    })

    it('应该处理空历史', () => {
      const result = validatePromptLength('系统提示', '用户问题', [])

      expect(result.valid).toBe(true)
    })
  })
})

/**
 * useChat Hook 单元测试
 * Story 3.1: 问答界面与输入处理
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useChat } from '@/hooks/useChat'

// Mock fetch
global.fetch = jest.fn()

describe('useChat Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应该正确初始化状态', () => {
      const { result } = renderHook(() => useChat())

      expect(result.current.messages).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.conversationId).toBeNull()
    })
  })

  describe('sendMessage', () => {
    it('缺少documentId时应该设置错误', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      expect(result.current.error).toBe('请先选择文档')
      expect(result.current.messages).toEqual([])
    })

    it('空问题时应该设置错误', async () => {
      const { result } = renderHook(() => useChat('doc-123'))

      await act(async () => {
        await result.current.sendMessage('   ')
      })

      expect(result.current.error).toBe('问题不能为空')
    })

    it('超长问题时应该设置错误', async () => {
      const { result } = renderHook(() => useChat('doc-123'))
      const longQuestion = 'a'.repeat(1001)

      await act(async () => {
        await result.current.sendMessage(longQuestion)
      })

      expect(result.current.error).toBe('问题过长，请精简')
    })

    it('成功发送消息时应该更新状态', async () => {
      const mockResponse = {
        success: true,
        data: { conversationId: 'conv-123' }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const { result } = renderHook(() => useChat('doc-123'))

      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.conversationId).toBeTruthy()
      
      // 应该有用户消息和占位回答
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[0].content).toBe('测试问题')
      expect(result.current.messages[0].status).toBe('success')
    })

    it('API错误时应该标记消息为错误状态', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: '服务器错误' })
      })

      const { result } = renderHook(() => useChat('doc-123'))

      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.messages[0].status).toBe('error')
    })

    it('401错误时应该显示登录过期消息', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      const { result } = renderHook(() => useChat('doc-123'))

      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.error).toBe('登录已过期，请重新登录')
      })
    })

    it('404错误时应该显示文档不存在消息', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const { result } = renderHook(() => useChat('doc-123'))

      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.error).toBe('文档不存在或已删除')
      })
    })
  })

  describe('retryMessage', () => {
    it('应该重新发送失败的消息', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })

      const { result } = renderHook(() => useChat('doc-123'))

      // 首次发送失败
      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      const failedMessageId = result.current.messages[0].id

      // 重试
      await act(async () => {
        result.current.retryMessage(failedMessageId)
      })

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(1)
      })
    })
  })

  describe('newConversation', () => {
    it('应该重置对话状态', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      const { result } = renderHook(() => useChat('doc-123'))

      // 发送消息
      await act(async () => {
        await result.current.sendMessage('测试问题')
      })

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThan(0)
      })

      // 新建对话
      act(() => {
        result.current.newConversation()
      })

      expect(result.current.messages).toEqual([])
      expect(result.current.conversationId).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('conversationId管理', () => {
    it('首次发送消息时应该生成conversationId', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })

      const { result } = renderHook(() => useChat('doc-123'))

      expect(result.current.conversationId).toBeNull()

      await act(async () => {
        await result.current.sendMessage('第一条消息')
      })

      await waitFor(() => {
        expect(result.current.conversationId).toBeTruthy()
      })

      const firstConvId = result.current.conversationId

      // 第二条消息应该使用相同的conversationId
      await act(async () => {
        await result.current.sendMessage('第二条消息')
      })

      expect(result.current.conversationId).toBe(firstConvId)
    })
  })
})

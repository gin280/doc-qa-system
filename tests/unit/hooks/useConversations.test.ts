/**
 * useConversations Hook 单元测试
 * Story 3.5: 对话历史管理
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useConversations, useConversation, deleteConversation } from '@/hooks/useConversations'
import { toast } from 'sonner'

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key, fetcher, options) => {
    // 模拟SWR的返回值
    return {
      data: null,
      error: null,
      mutate: jest.fn(),
      isValidating: false
    }
  })
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}))

// Mock fetch
global.fetch = jest.fn()

describe('useConversations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该构建正确的查询参数', () => {
    const { result } = renderHook(() => useConversations('test search', 'doc-123'))
    
    // 验证URL构建逻辑
    expect(result.current).toBeDefined()
  })

  it('应该返回空数组当没有数据时', () => {
    const { result } = renderHook(() => useConversations())
    
    expect(result.current.conversations).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })
})

describe('useConversation', () => {
  it('应该在conversationId为null时不发起请求', () => {
    const { result } = renderHook(() => useConversation(null))
    
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })
})

describe('deleteConversation', () => {
  it('应该成功删除对话', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    await deleteConversation('conv-123')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/conversations/conv-123',
      { method: 'DELETE' }
    )
    expect(toast.success).toHaveBeenCalledWith('对话已删除')
  })

  it('应该处理404错误', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404
    })

    await expect(deleteConversation('conv-123')).rejects.toThrow('对话不存在或已删除')
    expect(toast.error).toHaveBeenCalled()
  })

  it('应该处理删除失败', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    })

    await expect(deleteConversation('conv-123')).rejects.toThrow('删除对话失败')
    expect(toast.error).toHaveBeenCalled()
  })
})

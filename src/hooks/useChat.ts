/**
 * useChat Hook - 对话状态管理
 * Story 3.1: 问答界面与输入处理
 */

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

/**
 * 消息对象
 */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'pending' | 'success' | 'error'
}

/**
 * 对话Hook返回类型
 */
export interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  sendMessage: (question: string) => Promise<void>
  retryMessage: (messageId: string) => void
  newConversation: () => void
  conversationId: string | null
}

/**
 * 对话管理Hook
 * 
 * @param documentId - 选中的文档ID
 * @returns 对话状态和操作方法
 */
export function useChat(documentId?: string): UseChatReturn {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 发送问题
   */
  const sendMessage = useCallback(async (question: string) => {
    if (!documentId) {
      setError('请先选择文档')
      return
    }

    if (!question.trim()) {
      setError('问题不能为空')
      return
    }

    if (question.length > 1000) {
      setError('问题过长，请精简')
      return
    }

    // 生成conversationId(如果不存在)
    let currentConvId = conversationId
    if (!currentConvId) {
      currentConvId = uuidv4()
      setConversationId(currentConvId)
    }

    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: question,
      timestamp: new Date(),
      status: 'success'
    }

    // 添加到消息列表
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      // 调用API (本Story仅发送，不处理回答)
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          question,
          conversationId: currentConvId
        })
      })

      if (!response.ok) {
        // 处理HTTP错误
        if (response.status === 401) {
          throw new Error('登录已过期，请重新登录')
        } else if (response.status === 404) {
          throw new Error('文档不存在或已删除')
        } else if (response.status === 400) {
          const data = await response.json()
          throw new Error(data.error || '请求参数错误')
        } else {
          throw new Error('服务暂时不可用，请稍后重试')
        }
      }

      // Story 3.3将处理流式响应
      // 本Story仅验证API调用成功
      const data = await response.json()

      // 暂时添加占位回答
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '回答生成功能将在Story 3.3实现',
        timestamp: new Date(),
        status: 'success'
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (err: any) {
      console.error('Send message error:', err)
      const errorMessage = err.message || '发送失败，请重试'
      setError(errorMessage)
      
      // 标记用户消息为错误状态
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'error' as const }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }, [documentId, conversationId])

  /**
   * 重试发送失败的消息
   */
  const retryMessage = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message && message.role === 'user') {
      // 移除错误状态的消息
      setMessages(prev => prev.filter(m => m.id !== messageId))
      // 重新发送
      sendMessage(message.content)
    }
  }, [messages, sendMessage])

  /**
   * 新建对话
   */
  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    retryMessage,
    newConversation,
    conversationId
  }
}

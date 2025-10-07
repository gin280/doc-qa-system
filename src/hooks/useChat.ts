/**
 * useChat Hook - 对话状态管理
 * Story 3.1: 问答界面与输入处理 ✅
 * Story 3.3: LLM回答生成与流式输出 ✅
 * Story 3.5: 对话历史管理 ✅
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
  isLoadingHistory: boolean
  error: string | null
  sendMessage: (question: string) => Promise<void>
  retryMessage: (messageId: string) => void
  newConversation: () => void
  loadConversation: (conversationId: string) => Promise<void>
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
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

      // Story 3.3: 处理流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      // 从响应头获取conversationId
      const newConvId = response.headers.get('X-Conversation-Id')
      if (newConvId) {
        setConversationId(newConvId)
      }

      // 创建助手消息（初始为空）
      const assistantMessageId = uuidv4()
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'pending'
      }
      setMessages(prev => [...prev, assistantMessage])

      // 读取流式响应
      let fullContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk

        // 实时更新助手消息内容
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ))
      }

      // 标记消息为成功
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, status: 'success' as const }
          : msg
      ))

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

  /**
   * 加载历史对话
   * Story 3.5: AC6 - 继续对话功能
   * 
   * 注意：使用独立的 isLoadingHistory 状态，避免显示"AI思考中"
   */
  const loadConversation = useCallback(async (convId: string) => {
    setIsLoadingHistory(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/conversations/${convId}`)
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('对话不存在或已删除')
        }
        throw new Error('加载对话失败')
      }

      const data = await res.json()
      
      // 转换消息格式
      const loadedMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        status: 'success' as const
      }))

      setConversationId(convId)
      setMessages(loadedMessages)
    } catch (err: any) {
      console.error('Load conversation error:', err)
      const errorMessage = err.message || '加载对话失败'
      setError(errorMessage)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    retryMessage,
    newConversation,
    loadConversation,
    conversationId
  }
}

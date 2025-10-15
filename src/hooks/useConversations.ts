// src/hooks/useConversations.ts
import useSWR from 'swr'
import { toast } from 'sonner'
import { getErrorMessage } from '@/types/errors'

/**
 * 对话对象
 */
export interface Conversation {
  id: string
  title: string
  documentId: string
  documentName: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

/**
 * 消息对象
 */
export interface ConversationMessage {
  id: string
  conversationId: string
  role: 'USER' | 'ASSISTANT'
  content: string
  citations: unknown
  tokenCount: number
  createdAt: string
}

/**
 * 对话详情
 */
export interface ConversationDetail {
  conversation: Conversation
  messages: ConversationMessage[]
}

/**
 * 对话列表响应
 */
interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

/**
 * SWR fetcher
 */
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('登录已过期，请重新登录')
    }
    if (res.status === 404) {
      throw new Error('对话不存在或已删除')
    }
    throw new Error('获取对话失败')
  }
  return res.json()
}

/**
 * 获取对话列表
 */
export function useConversations(search?: string, documentId?: string) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (documentId) params.set('documentId', documentId)

  const queryString = params.toString()
  const url = `/api/conversations${queryString ? `?${queryString}` : ''}`

  const { data, error, mutate, isValidating } = useSWR<ConversationsResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 10000, // 每10秒自动刷新对话列表
      dedupingInterval: 2000
    }
  )

  return {
    conversations: data?.conversations || [],
    pagination: data?.pagination,
    isLoading: !error && !data,
    isError: error,
    isValidating,
    mutate
  }
}

/**
 * 获取单个对话详情
 */
export function useConversation(conversationId: string | null) {
  const { data, error, mutate } = useSWR<ConversationDetail>(
    conversationId ? `/api/conversations/${conversationId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000
    }
  )

  return {
    conversation: data?.conversation,
    messages: data?.messages || [],
    isLoading: !error && !data && !!conversationId,
    isError: error,
    mutate
  }
}

/**
 * 删除对话
 */
export async function deleteConversation(conversationId: string) {
  try {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE'
    })

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('对话不存在或已删除')
      }
      throw new Error('删除对话失败')
    }

    toast.success('对话已删除')
    return await res.json()
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    toast.error(errorMessage)
    throw error
  }
}

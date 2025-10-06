/**
 * ChatContainer - 聊天容器组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { useState, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { DocumentSelector } from './DocumentSelector'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { Button } from '@/components/ui/button'
import { PlusCircle, FileText, ArrowLeft, Home } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Props {
  initialDocumentId?: string
}

/**
 * 聊天容器组件
 * 整合所有聊天相关子组件
 */
export function ChatContainer({ initialDocumentId }: Props) {
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(initialDocumentId)
  
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    retryMessage,
    newConversation,
    conversationId
  } = useChat(selectedDocId)

  // 错误提示
  useEffect(() => {
    if (error) {
      toast.error(error, {
        duration: 5000,
        action: {
          label: '关闭',
          onClick: () => {}
        }
      })
    }
  }, [error])

  /**
   * 处理文档切换
   */
  const handleDocumentChange = (docId: string) => {
    if (messages.length > 0) {
      // 如果有对话历史，提示用户
      const confirmed = window.confirm(
        '切换文档将开始新对话，当前对话记录将被清空。是否继续？'
      )
      if (!confirmed) return
    }
    
    setSelectedDocId(docId)
    newConversation()
    
    // 更新URL参数
    const url = new URL(window.location.href)
    url.searchParams.set('docId', docId)
    window.history.pushState({}, '', url)
  }

  /**
   * 处理示例问题点击
   */
  const handleExampleClick = (question: string) => {
    if (selectedDocId) {
      sendMessage(question)
    } else {
      toast.error('请先选择文档')
    }
  }

  /**
   * 处理新建对话
   */
  const handleNewConversation = () => {
    if (messages.length === 0) return

    const confirmed = window.confirm(
      '确定要开始新对话吗？当前对话记录将被清空。'
    )
    if (confirmed) {
      newConversation()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - 导航和工具栏 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            {/* 返回按钮 */}
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            
            {/* 标题 */}
            <div className="flex-1">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                智能问答
              </h1>
            </div>

            {/* 新建对话按钮 */}
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewConversation}
                className="flex-shrink-0"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">新建对话</span>
              </Button>
            )}
          </div>

          {/* 文档选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">选择文档:</span>
            <DocumentSelector
              value={selectedDocId}
              onChange={handleDocumentChange}
            />
          </div>
        </div>
      </div>

      {/* 消息列表区域 */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        onRetry={retryMessage}
        onExampleClick={handleExampleClick}
      />

      {/* 输入区域 */}
      <ChatInput
        onSend={sendMessage}
        disabled={!selectedDocId}
        isLoading={isLoading}
        placeholder={
          selectedDocId 
            ? "请输入您的问题..." 
            : "请先选择文档..."
        }
      />

      {/* 会话ID提示（开发模式） */}
      {process.env.NODE_ENV === 'development' && conversationId && (
        <div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground text-center">
          会话ID: {conversationId}
        </div>
      )}
    </div>
  )
}

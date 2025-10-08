/**
 * ChatWithHistory - 带对话历史的聊天容器
 * Story 3.5: 对话历史管理
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChat } from '@/hooks/useChat'
import { DocumentSelector } from './DocumentSelector'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { ConversationList } from './ConversationList'
import { ExportButton } from './ExportButton'
import { Button } from '@/components/ui/button'
import { PlusCircle, FileText, Home, Menu, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Props {
  initialDocumentId?: string
}

/**
 * 带对话历史的聊天容器
 */
export function ChatWithHistory({ initialDocumentId }: Props) {
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(initialDocumentId)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    retryMessage,
    newConversation,
    loadConversation,
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
  const handleDocumentChange = useCallback((docId: string) => {
    if (messages.length > 0) {
      // 如果有对话历史，提示用户
      const confirmed = window.confirm(
        '切换文档将开始新对话，当前对话记录将被保存。是否继续？'
      )
      if (!confirmed) return
    }
    
    setSelectedDocId(docId)
    newConversation()
    
    // 更新URL参数
    const url = new URL(window.location.href)
    url.searchParams.set('docId', docId)
    window.history.pushState({}, '', url)
  }, [messages.length, newConversation])

  /**
   * 处理示例问题点击
   */
  const handleExampleClick = useCallback((question: string) => {
    if (selectedDocId) {
      sendMessage(question)
    } else {
      toast.error('请先选择文档')
    }
  }, [selectedDocId, sendMessage])

  /**
   * 处理新建对话
   */
  const handleNewConversation = useCallback(() => {
    if (messages.length === 0) return

    const confirmed = window.confirm(
      '确定要开始新对话吗？当前对话记录将被保存。'
    )
    if (confirmed) {
      newConversation()
    }
  }, [messages.length, newConversation])

  /**
   * 处理对话选择（加载历史对话）
   * 注意：对话会自动保存，不需要确认弹窗
   */
  const handleConversationSelect = useCallback(async (convId: string) => {
    // 空字符串表示清空当前对话（例如删除了当前对话）
    if (!convId || convId === '') {
      newConversation()
      return
    }

    if (convId === conversationId) return

    try {
      await loadConversation(convId)
      
      // 移动端自动关闭侧边栏
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      }
    } catch (error) {
      console.error('Load conversation failed:', error)
    }
  }, [conversationId, loadConversation, newConversation])

  return (
    <div className="flex h-full">
      {/* 左侧对话历史侧边栏 */}
      <div
        className={cn(
          'border-r bg-background transition-all duration-300',
          'flex flex-col',
          isSidebarOpen ? 'w-80' : 'w-0',
          'md:relative absolute inset-y-0 left-0 z-20'
        )}
      >
        {isSidebarOpen && (
          <>
            {/* 侧边栏头部 */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">对话历史</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 对话列表 */}
            <ConversationList
              activeConversationId={conversationId || undefined}
              onConversationSelect={handleConversationSelect}
              documentId={selectedDocId}
            />
          </>
        )}
      </div>

      {/* 右侧主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* Header - 导航和工具栏 */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              {/* 侧边栏切换按钮 */}
              {!isSidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(true)}
                  className="h-9 w-9"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}

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

              {/* 导出按钮 */}
              {conversationId && messages.length > 0 && (
                <ExportButton
                  conversationId={conversationId}
                  conversationTitle={`对话_${new Date().toLocaleDateString()}`}
                  className="flex-shrink-0"
                />
              )}

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
        {isLoadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">正在加载历史对话...</p>
            </div>
          </div>
        ) : (
          <ChatMessageList
            messages={messages}
            isLoading={isLoading}
            onRetry={retryMessage}
            onExampleClick={handleExampleClick}
          />
        )}

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

      {/* 移动端遮罩层 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  )
}

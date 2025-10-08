/**
 * ChatWithHistory - 带对话历史的聊天容器
 * Story 3.5: 对话历史管理
 * Story 1.10: 移除内部Header,适配AppHeader架构
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChat } from '@/hooks/useChat'
import { DocumentSelector } from './DocumentSelector'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'
import { ConversationList } from './ConversationList'
import { ExportButton } from './ExportButton'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { PlusCircle, Menu, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  initialDocumentId?: string
}

/**
 * 带对话历史的聊天容器
 * 
 * Story 1.10 重构:
 * - 移除了内部Header(AppHeader现在提供统一导航)
 * - 保留左侧边栏(对话历史 + 文档选择器)
 * - 简化布局,专注于对话功能
 */
export function ChatWithHistory({ initialDocumentId }: Props) {
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(initialDocumentId)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [conversationListKey, setConversationListKey] = useState(0)
  
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

  // 监听 conversationId 变化，当创建新对话时刷新对话列表
  useEffect(() => {
    if (conversationId) {
      // 有新的 conversationId，说明创建了新对话或切换了对话
      // 刷新对话列表以显示最新状态
      setConversationListKey(prev => prev + 1)
    }
  }, [conversationId])

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
    url.searchParams.set('doc', docId)
    window.history.pushState({}, '', url)
  }, [messages.length, newConversation])

  /**
   * 处理示例问题点击
   */
  const handleExampleClick = useCallback(async (question: string) => {
    if (selectedDocId) {
      await sendMessage(question)
      // 发送消息后刷新对话列表
      setConversationListKey(prev => prev + 1)
    } else {
      toast.error('请先选择文档')
    }
  }, [selectedDocId, sendMessage])

  /**
   * 处理新建对话
   * 直接新建，不需要确认（对话会自动保存）
   */
  const handleNewConversation = useCallback(() => {
    newConversation()
  }, [newConversation])

  /**
   * 处理对话选择（加载历史对话）
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
      {/* 左侧边栏 */}
      <div
        className={cn(
          'border-r bg-background transition-all duration-300',
          'flex flex-col',
          isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden',
          'md:relative absolute inset-y-0 left-0 z-20'
        )}
      >
        {isSidebarOpen && (
          <>
            {/* 侧边栏头部 - 新建对话按钮 */}
            <div className="border-b p-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  onClick={handleNewConversation}
                  className="flex-1 gap-2"
                  size="sm"
                  variant="outline"
                >
                  <PlusCircle className="h-4 w-4" />
                  新建对话
                </Button>
                
                {/* 移动端关闭按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 文档选择器 */}
            <div className="border-b p-3">
              <DocumentSelector
                key={refreshKey}
                value={selectedDocId}
                onChange={handleDocumentChange}
              />
            </div>

            {/* 对话历史列表 */}
            <ConversationList
              key={conversationListKey}
              activeConversationId={conversationId || undefined}
              onConversationSelect={handleConversationSelect}
              documentId={selectedDocId}
            />
          </>
        )}
      </div>

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 工具栏 */}
        <div className="border-b bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            {/* 侧边栏切换按钮 */}
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                className="h-9 w-9"
                aria-label="打开侧边栏"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}

            {/* 导出按钮 */}
            {conversationId && messages.length > 0 && (
              <div className="ml-auto">
                <ExportButton conversationId={conversationId} />
              </div>
            )}
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-hidden">
          <ChatMessageList
            messages={messages}
            isLoading={isLoading}
            isLoadingHistory={isLoadingHistory}
            onRetry={retryMessage}
            onExampleClick={handleExampleClick}
            onUploadClick={() => setUploadModalOpen(true)}
            selectedDocument={selectedDocId ? { id: selectedDocId, name: '' } : null}
          />
        </div>

        {/* 输入框 */}
        <div className="border-t bg-background p-4">
          <ChatInput
            onSend={async (message) => {
              await sendMessage(message)
              // 发送消息后刷新对话列表
              setConversationListKey(prev => prev + 1)
            }}
            disabled={!selectedDocId || isLoading}
            placeholder={
              selectedDocId 
                ? "输入您的问题..." 
                : "请先从左侧选择一个文档"
            }
          />
        </div>
      </div>

      {/* 移动端遮罩层 */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 上传文档 Modal */}
      <DocumentUploadModal 
        open={uploadModalOpen}
        onOpenChange={(open) => {
          setUploadModalOpen(open)
          // Modal 关闭时刷新文档列表
          if (!open) {
            setRefreshKey(prev => prev + 1)
          }
        }}
      />
    </div>
  )
}

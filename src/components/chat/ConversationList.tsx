/**
 * ConversationList - 对话列表组件
 * Story 3.5: 对话历史管理
 */

'use client'

import { useState, useCallback } from 'react'
import { useConversations, deleteConversation } from '@/hooks/useConversations'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Search, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConversationListProps {
  activeConversationId?: string
  onConversationSelect: (conversationId: string) => void
  documentId?: string
}

/**
 * 对话列表组件
 */
export function ConversationList({
  activeConversationId,
  onConversationSelect,
  documentId
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 获取对话列表（使用debounced search）
  const { conversations, isLoading, isError, mutate } = useConversations(search, documentId)

  /**
   * 处理删除确认
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteId) return
    
    const isCurrentConversation = activeConversationId === deleteId
    
    setIsDeleting(true)
    try {
      await deleteConversation(deleteId)
      
      // 刷新列表
      mutate()
      
      // 如果删除的是当前活动对话，清空选择
      if (isCurrentConversation) {
        onConversationSelect('')
        toast.success('对话已删除，已为您创建新对话')
      } else {
        toast.success('对话已删除')
      }
    } catch (error) {
      console.error('Delete conversation error:', error)
      toast.error('删除对话失败，请重试')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }, [deleteId, mutate, activeConversationId, onConversationSelect])

  /**
   * 打开删除确认对话框
   */
  const handleDeleteClick = useCallback((conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteId(conversationId)
  }, [])

  return (
    <>
      <div className="flex flex-col h-full">
        {/* 搜索框 - 始终可见 */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索对话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 对话列表 */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            // 加载状态
            <div className="flex items-center justify-center h-full py-8">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">加载中...</p>
              </div>
            </div>
          ) : isError ? (
            // 错误状态
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-red-500">加载失败</p>
                <Button variant="outline" size="sm" onClick={() => mutate()}>
                  重试
                </Button>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            // 空状态
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">
                {search ? '没有找到匹配的对话' : '还没有对话记录'}
              </p>
              <p className="text-sm mt-2">
                {search ? '尝试其他搜索词' : '开始提问创建新对话'}
              </p>
            </div>
          ) : (
            // 对话列表
            <div className="p-2 space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => onConversationSelect(conversation.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-colors',
                    'flex items-start justify-between group',
                    'hover:bg-accent',
                    activeConversationId === conversation.id && 
                      'bg-primary/10 hover:bg-primary/15'
                  )}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-medium text-sm truncate mb-1">
                      {conversation.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {conversation.documentName}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{conversation.messageCount} 条消息</span>
                      <span>
                        {formatDistanceToNow(new Date(conversation.updatedAt), {
                          locale: zhCN,
                          addSuffix: true
                        })}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'flex-shrink-0 h-8 w-8',
                      'opacity-0 group-hover:opacity-100 transition-opacity'
                    )}
                    onClick={(e) => handleDeleteClick(conversation.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                '删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

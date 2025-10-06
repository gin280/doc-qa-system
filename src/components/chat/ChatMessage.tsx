/**
 * ChatMessage - 单条消息组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertCircle, RefreshCcw, User, Bot } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Message } from '@/hooks/useChat'

interface Props {
  message: Message
  onRetry?: (messageId: string) => void
}

/**
 * 单条消息组件
 * - 用户消息：右对齐，蓝色气泡
 * - AI消息：左对齐，白色卡片
 * - 显示时间戳
 * - 错误状态显示重试按钮
 */
export function ChatMessage({ message, onRetry }: Props) {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'

  // 格式化时间戳（相对时间）
  const timeAgo = formatDistanceToNow(message.timestamp, {
    addSuffix: true,
    locale: zhCN
  })

  if (isUser) {
    // 用户消息 - 右对齐蓝色气泡
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="flex flex-col items-end gap-1 max-w-[80%]">
          {/* 消息气泡 */}
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm",
              isError 
                ? "bg-destructive/10 border border-destructive/20" 
                : "bg-primary text-primary-foreground"
            )}
          >
            {message.content}
          </div>
          
          {/* 时间戳和状态 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isError && (
              <>
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-destructive">发送失败</span>
              </>
            )}
            <span>{timeAgo}</span>
            {isError && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs hover:text-primary"
                onClick={() => onRetry(message.id)}
              >
                <RefreshCcw className="h-3 w-3 mr-1" />
                重试
              </Button>
            )}
          </div>
        </div>

        {/* 用户头像 */}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    )
  }

  // AI消息 - 左对齐白色卡片
  return (
    <div className="flex items-start gap-3">
      {/* AI头像 */}
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1 max-w-[80%]">
        {/* 消息卡片 */}
        <Card className="p-4">
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </Card>

        {/* 时间戳 */}
        <span className="text-xs text-muted-foreground ml-1">
          {timeAgo}
        </span>
      </div>
    </div>
  )
}

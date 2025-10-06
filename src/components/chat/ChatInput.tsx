/**
 * ChatInput - 问答输入框组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  className?: string
}

const MAX_LENGTH = 1000

/**
 * 聊天输入框组件
 * 支持：
 * - 自动高度调整（最多5行）
 * - 字符计数
 * - 快捷键（Ctrl/Cmd+Enter发送，Shift+Enter换行）
 * - 输入验证
 */
export function ChatInput({ 
  onSend, 
  disabled, 
  isLoading,
  placeholder = "请输入您的问题...",
  className 
}: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动聚焦
  useEffect(() => {
    if (!disabled && !isLoading) {
      textareaRef.current?.focus()
    }
  }, [disabled, isLoading])

  // 自动调整高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px` // 最多5行约120px
    }
  }, [input])

  /**
   * 发送消息
   */
  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && trimmed.length <= MAX_LENGTH) {
      onSend(trimmed)
      setInput('')
      // 重置高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  /**
   * 键盘事件处理
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.metaKey || e.ctrlKey) {
        // Ctrl/Cmd+Enter 发送
        e.preventDefault()
        handleSend()
      } else if (e.shiftKey) {
        // Shift+Enter 换行 (默认行为，不阻止)
      } else {
        // 普通Enter 发送
        e.preventDefault()
        handleSend()
      }
    }
  }

  const isOverLimit = input.length > MAX_LENGTH
  const isSendDisabled = disabled || isLoading || !input.trim() || isOverLimit

  return (
    <div className={cn("border-t bg-background p-4", className)}>
      <div className="mx-auto max-w-4xl">
        {/* 输入区域 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              className="min-h-[60px] max-h-[120px] resize-none pr-16"
              aria-label="请输入您的问题"
            />
            {/* 字符计数 */}
            <div 
              className={cn(
                "absolute bottom-2 right-2 text-xs",
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}
              aria-live="polite"
            >
              {input.length}/{MAX_LENGTH}
            </div>
          </div>

          {/* 发送按钮 */}
          <Button
            onClick={handleSend}
            disabled={isSendDisabled}
            size="lg"
            className="self-end"
            aria-label="发送问题"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>按 Enter 发送，Shift+Enter 换行</span>
          {isOverLimit && (
            <span className="text-destructive font-medium" role="alert">
              问题过长，请精简
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

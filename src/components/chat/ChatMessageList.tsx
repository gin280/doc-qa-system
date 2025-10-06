/**
 * ChatMessageList - 消息列表组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage } from './ChatMessage'
import { EmptyState } from './EmptyState'
import type { Message } from '@/hooks/useChat'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  messages: Message[]
  isLoading: boolean
  onRetry?: (messageId: string) => void
  onExampleClick?: (question: string) => void
}

/**
 * 消息列表组件
 * - 显示消息历史
 * - 自动滚动到底部
 * - 加载指示器
 * - 空状态
 */
export function ChatMessageList({ messages, isLoading, onRetry, onExampleClick }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    })
  }, [messages, isLoading])

  // 空状态
  if (messages.length === 0 && !isLoading) {
    return <EmptyState onExampleClick={onExampleClick} />
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
      role="log"
      aria-live="polite"
      aria-label="对话历史"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 消息列表 */}
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ChatMessage 
                message={message} 
                onRetry={onRetry}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 加载指示器 */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
            aria-live="assertive"
            aria-label="AI思考中"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-muted px-5 py-3 border">
              {/* 三点动画 */}
              <div className="flex gap-1">
                <div 
                  className="h-2 w-2 animate-bounce rounded-full bg-primary" 
                  style={{ animationDelay: '0ms' }} 
                />
                <div 
                  className="h-2 w-2 animate-bounce rounded-full bg-primary" 
                  style={{ animationDelay: '150ms' }} 
                />
                <div 
                  className="h-2 w-2 animate-bounce rounded-full bg-primary" 
                  style={{ animationDelay: '300ms' }} 
                />
              </div>
              <span className="text-sm text-muted-foreground">
                AI思考中...
              </span>
            </div>
          </motion.div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

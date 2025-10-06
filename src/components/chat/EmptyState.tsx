/**
 * EmptyState - 空状态组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { MessageSquare, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface Props {
  onExampleClick?: (question: string) => void
}

/**
 * 示例问题列表
 */
const EXAMPLE_QUESTIONS = [
  "这个文档主要讲了什么？",
  "有哪些关键要点？",
  "请总结一下核心内容",
  "文档中提到的技术方案是什么？"
]

/**
 * 空状态组件
 * - 欢迎信息
 * - 示例问题
 * - 使用提示
 */
export function EmptyState({ onExampleClick }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      {/* 图标 */}
      <div className="relative mb-6">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 blur-lg" />
        <div className="relative bg-background rounded-full p-4 border-2 border-primary/20">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
      </div>

      {/* 标题 */}
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        开始对话
      </h2>

      {/* 描述 */}
      <p className="text-muted-foreground mb-8 max-w-md">
        选择一个文档，向AI提问任何关于文档内容的问题，获得准确的答案和引用
      </p>

      {/* 示例问题 */}
      <div className="w-full max-w-2xl">
        <p className="text-sm text-muted-foreground mb-4">试试这些问题：</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAMPLE_QUESTIONS.map((question, index) => (
            <Card
              key={index}
              className="p-4 text-left hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onExampleClick?.(question)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onExampleClick?.(question)
                }
              }}
            >
              <p className="text-sm">{question}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* 使用提示 */}
      <div className="mt-8 text-xs text-muted-foreground max-w-md">
        💡 提示：您可以使用 Enter 发送消息，Shift+Enter 换行
      </div>
    </div>
  )
}

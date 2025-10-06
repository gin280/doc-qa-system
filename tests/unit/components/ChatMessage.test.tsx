/**
 * ChatMessage Component 单元测试
 * Story 3.1: 问答界面与输入处理
 * 解决 QA Issue: TEST-001
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { Message } from '@/hooks/useChat'

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2分钟前'),
}))

jest.mock('date-fns/locale', () => ({
  zhCN: {},
}))

describe('ChatMessage组件', () => {
  const mockOnRetry = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('用户消息渲染 (AC4)', () => {
    const userMessage: Message = {
      id: 'msg-1',
      role: 'user',
      content: '这是一个测试问题',
      timestamp: new Date('2025-01-07T10:00:00'),
      status: 'success',
    }

    it('应该渲染用户消息内容', () => {
      render(<ChatMessage message={userMessage} />)
      
      expect(screen.getByText('这是一个测试问题')).toBeInTheDocument()
    })

    it('用户消息应该有正确的样式类', () => {
      render(<ChatMessage message={userMessage} />)
      
      const messageText = screen.getByText('这是一个测试问题')
      const messageBubble = messageText.closest('div')
      
      expect(messageBubble).toHaveClass('bg-primary')
      expect(messageBubble).toHaveClass('text-primary-foreground')
      expect(messageBubble).toHaveClass('rounded-2xl')
    })

    it('应该显示用户头像图标', () => {
      render(<ChatMessage message={userMessage} />)
      
      // 检查User图标是否存在（通过其SVG属性）
      const avatar = document.querySelector('.h-8.w-8')
      expect(avatar).toBeInTheDocument()
    })

    it('应该显示时间戳', () => {
      render(<ChatMessage message={userMessage} />)
      
      expect(screen.getByText('2分钟前')).toBeInTheDocument()
    })

    it('用户消息应该右对齐', () => {
      const { container } = render(<ChatMessage message={userMessage} />)
      
      // 检查最外层容器有justify-end类
      const outerContainer = container.querySelector('.justify-end')
      expect(outerContainer).toBeInTheDocument()
    })
  })

  describe('AI消息渲染 (AC4)', () => {
    const aiMessage: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: '这是AI的回答',
      timestamp: new Date('2025-01-07T10:01:00'),
      status: 'success',
    }

    it('应该渲染AI消息内容', () => {
      render(<ChatMessage message={aiMessage} />)
      
      expect(screen.getByText('这是AI的回答')).toBeInTheDocument()
    })

    it('AI消息应该使用Card组件', () => {
      render(<ChatMessage message={aiMessage} />)
      
      const messageText = screen.getByText('这是AI的回答')
      const card = messageText.closest('.p-4')
      
      expect(card).toBeInTheDocument()
    })

    it('应该显示AI头像图标', () => {
      render(<ChatMessage message={aiMessage} />)
      
      // Bot图标应该存在
      const avatar = document.querySelector('.h-8.w-8')
      expect(avatar).toBeInTheDocument()
    })

    it('应该显示时间戳', () => {
      render(<ChatMessage message={aiMessage} />)
      
      expect(screen.getByText('2分钟前')).toBeInTheDocument()
    })

    it('AI消息应该左对齐', () => {
      const { container } = render(<ChatMessage message={aiMessage} />)
      
      // 检查最外层容器有items-start和gap-3类，但没有justify-end
      const outerContainer = container.querySelector('.items-start.gap-3')
      expect(outerContainer).toBeInTheDocument()
      
      // 确认没有justify-end（用户消息才有）
      const rightAligned = container.querySelector('.justify-end')
      expect(rightAligned).not.toBeInTheDocument()
    })
  })

  describe('错误状态处理 (AC6)', () => {
    const errorMessage: Message = {
      id: 'msg-3',
      role: 'user',
      content: '发送失败的消息',
      timestamp: new Date('2025-01-07T10:02:00'),
      status: 'error',
    }

    it('错误消息应该显示错误样式', () => {
      render(<ChatMessage message={errorMessage} />)
      
      const messageText = screen.getByText('发送失败的消息')
      const messageBubble = messageText.closest('div')
      
      expect(messageBubble).toHaveClass('bg-destructive/10')
      expect(messageBubble).toHaveClass('border-destructive/20')
    })

    it('应该显示"发送失败"文本', () => {
      render(<ChatMessage message={errorMessage} />)
      
      expect(screen.getByText('发送失败')).toBeInTheDocument()
    })

    it('应该显示错误图标', () => {
      render(<ChatMessage message={errorMessage} />)
      
      // AlertCircle图标应该存在
      const errorIcon = document.querySelector('.text-destructive')
      expect(errorIcon).toBeInTheDocument()
    })

    it('应该显示重试按钮', () => {
      render(<ChatMessage message={errorMessage} onRetry={mockOnRetry} />)
      
      const retryButton = screen.getByRole('button', { name: /重试/i })
      expect(retryButton).toBeInTheDocument()
    })

    it('点击重试按钮应该调用onRetry', () => {
      render(<ChatMessage message={errorMessage} onRetry={mockOnRetry} />)
      
      const retryButton = screen.getByRole('button', { name: /重试/i })
      fireEvent.click(retryButton)
      
      expect(mockOnRetry).toHaveBeenCalledWith('msg-3')
    })

    it('没有onRetry回调时不应该显示重试按钮', () => {
      render(<ChatMessage message={errorMessage} />)
      
      const retryButton = screen.queryByRole('button', { name: /重试/i })
      expect(retryButton).not.toBeInTheDocument()
    })
  })

  describe('消息内容格式化', () => {
    it('应该保留换行符（whitespace-pre-wrap）', () => {
      const multilineMessage: Message = {
        id: 'msg-4',
        role: 'assistant',
        content: '第一行\n第二行\n第三行',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={multilineMessage} />)
      
      const messageContent = screen.getByText(/第一行/)
      expect(messageContent).toHaveClass('whitespace-pre-wrap')
    })

    it('应该正确渲染长文本', () => {
      const longMessage: Message = {
        id: 'msg-5',
        role: 'assistant',
        content: 'a'.repeat(500),
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={longMessage} />)
      
      const content = screen.getByText('a'.repeat(500))
      expect(content).toBeInTheDocument()
    })
  })

  describe('消息宽度限制 (AC4)', () => {
    it('用户消息应该有最大宽度限制', () => {
      const userMessage: Message = {
        id: 'msg-6',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={userMessage} />)
      
      const container = screen.getByText('测试').closest('.max-w-\\[80\\%\\]')
      expect(container).toBeInTheDocument()
    })

    it('AI消息应该有最大宽度限制', () => {
      const aiMessage: Message = {
        id: 'msg-7',
        role: 'assistant',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={aiMessage} />)
      
      const container = screen.getByText('测试').closest('.max-w-\\[80\\%\\]')
      expect(container).toBeInTheDocument()
    })
  })

  describe('时间戳格式化', () => {
    it('应该使用中文本地化格式', () => {
      const message: Message = {
        id: 'msg-8',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={message} />)
      
      // date-fns被mock返回"2分钟前"
      expect(screen.getByText('2分钟前')).toBeInTheDocument()
    })

    it('应该为每条消息显示时间戳', () => {
      const message: Message = {
        id: 'msg-9',
        role: 'assistant',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={message} />)
      
      const timestamp = screen.getByText('2分钟前')
      expect(timestamp).toHaveClass('text-xs')
      expect(timestamp).toHaveClass('text-muted-foreground')
    })
  })

  describe('边界情况', () => {
    it('应该处理空消息内容', () => {
      const emptyMessage: Message = {
        id: 'msg-10',
        role: 'user',
        content: '',
        timestamp: new Date(),
        status: 'success',
      }

      const { container } = render(<ChatMessage message={emptyMessage} />)
      expect(container).toBeInTheDocument()
    })

    it('应该处理特殊字符', () => {
      const specialMessage: Message = {
        id: 'msg-11',
        role: 'user',
        content: '<script>alert("XSS")</script>',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={specialMessage} />)
      
      // React自动转义，应该显示为文本而不是执行
      expect(screen.getByText('<script>alert("XSS")</script>')).toBeInTheDocument()
    })

    it('应该处理表情符号', () => {
      const emojiMessage: Message = {
        id: 'msg-12',
        role: 'user',
        content: '这是一个测试 😊 🎉 ✨',
        timestamp: new Date(),
        status: 'success',
      }

      render(<ChatMessage message={emojiMessage} />)
      
      expect(screen.getByText('这是一个测试 😊 🎉 ✨')).toBeInTheDocument()
    })
  })
})

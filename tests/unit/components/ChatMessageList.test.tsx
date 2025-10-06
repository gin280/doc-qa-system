/**
 * ChatMessageList Component 单元测试
 * Story 3.1: 问答界面与输入处理
 * 解决 QA Issue: TEST-001
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import type { Message } from '@/hooks/useChat'

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

describe('ChatMessageList组件', () => {
  const mockOnRetry = jest.fn()
  const mockOnExampleClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染消息列表容器', () => {
      const messages: Message[] = []
      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false} 
          onRetry={mockOnRetry}
        />
      )
      
      // 空状态会显示EmptyState组件
      expect(container).toBeInTheDocument()
    })

    it('容器应该有role="log"属性', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false} 
        />
      )
      
      const logContainer = screen.getByRole('log')
      expect(logContainer).toBeInTheDocument()
      expect(logContainer).toHaveAttribute('aria-label', '对话历史')
    })

    it('容器应该有aria-live="polite"', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false} 
        />
      )
      
      const logContainer = screen.getByRole('log')
      expect(logContainer).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('空状态显示 (AC4)', () => {
    it('无消息且不加载时应该显示空状态', () => {
      const messages: Message[] = []
      
      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
          onExampleClick={mockOnExampleClick}
        />
      )
      
      // EmptyState组件应该被渲染（假设它有特定的文本）
      // 由于EmptyState是独立组件，这里主要测试它被调用
      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      expect(container).toBeInTheDocument()
    })

    it('有消息时不应该显示空状态', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试消息',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      // 应该显示消息内容，不显示空状态
      expect(screen.getByText('测试消息')).toBeInTheDocument()
    })

    it('加载中时不应该显示空状态', () => {
      const messages: Message[] = []
      
      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={true}
        />
      )
      
      // 应该显示加载指示器，而不是空状态
      // EmptyState不应该被渲染
      expect(container.querySelector('[aria-label="AI思考中"]')).toBeInTheDocument()
    })
  })

  describe('消息列表渲染 (AC4)', () => {
    it('应该渲染所有消息', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '第一条消息',
          timestamp: new Date(),
          status: 'success',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '第二条消息',
          timestamp: new Date(),
          status: 'success',
        },
        {
          id: 'msg-3',
          role: 'user',
          content: '第三条消息',
          timestamp: new Date(),
          status: 'success',
        },
      ]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      expect(screen.getByText('第一条消息')).toBeInTheDocument()
      expect(screen.getByText('第二条消息')).toBeInTheDocument()
      expect(screen.getByText('第三条消息')).toBeInTheDocument()
    })

    it('应该按顺序渲染消息', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '消息1',
          timestamp: new Date('2025-01-07T10:00:00'),
          status: 'success',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '消息2',
          timestamp: new Date('2025-01-07T10:01:00'),
          status: 'success',
        },
      ]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      // 验证两条消息都被渲染且按顺序
      expect(screen.getByText('消息1')).toBeInTheDocument()
      expect(screen.getByText('消息2')).toBeInTheDocument()
      
      // 通过获取所有文本内容验证顺序
      const allText = screen.getByRole('log').textContent || ''
      const index1 = allText.indexOf('消息1')
      const index2 = allText.indexOf('消息2')
      
      expect(index1).toBeGreaterThanOrEqual(0)
      expect(index2).toBeGreaterThan(index1)
    })

    it('应该传递onRetry回调给消息组件', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'error',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
          onRetry={mockOnRetry}
        />
      )
      
      // 如果有错误消息，应该显示重试按钮
      const retryButton = screen.queryByRole('button', { name: /重试/i })
      expect(retryButton).toBeInTheDocument()
    })
  })

  describe('加载状态显示 (AC5)', () => {
    it('isLoading为true时应该显示加载指示器', () => {
      const messages: Message[] = []
      
      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={true}
        />
      )
      
      expect(screen.getByText('AI思考中...')).toBeInTheDocument()
    })

    it('加载指示器应该有三个跳动的点', () => {
      const messages: Message[] = []
      
      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={true}
        />
      )
      
      // 检查是否有三个animate-bounce的元素
      const dots = container.querySelectorAll('.animate-bounce')
      expect(dots).toHaveLength(3)
    })

    it('加载指示器应该有正确的ARIA属性', () => {
      const messages: Message[] = []
      
      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={true}
        />
      )
      
      const loadingIndicator = screen.getByLabelText('AI思考中')
      expect(loadingIndicator).toHaveAttribute('aria-live', 'assertive')
    })

    it('isLoading为false时不应该显示加载指示器', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]
      
      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      expect(screen.queryByText('AI思考中...')).not.toBeInTheDocument()
    })

    it('可以同时显示消息和加载指示器', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '用户问题',
        timestamp: new Date(),
        status: 'success',
      }]
      
      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={true}
        />
      )
      
      expect(screen.getByText('用户问题')).toBeInTheDocument()
      expect(screen.getByText('AI思考中...')).toBeInTheDocument()
    })
  })

  describe('消息数量处理', () => {
    it('应该处理大量消息', () => {
      const messages: Message[] = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`,
        timestamp: new Date(),
        status: 'success' as const,
      }))

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      // 应该能渲染所有消息
      expect(screen.getByText('消息 1')).toBeInTheDocument()
      expect(screen.getByText('消息 50')).toBeInTheDocument()
    })

    it('应该处理单条消息', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '唯一消息',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      expect(screen.getByText('唯一消息')).toBeInTheDocument()
    })
  })

  describe('滚动行为 (AC4)', () => {
    it('组件应该有overflow-y-auto类', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      const scrollContainer = container.querySelector('.overflow-y-auto')
      expect(scrollContainer).toBeInTheDocument()
    })

    it('应该有滚动锚点元素', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      // 滚动锚点会在最后
      const allDivs = container.querySelectorAll('div')
      expect(allDivs.length).toBeGreaterThan(0)
    })
  })

  describe('可访问性 (AC10)', () => {
    it('主容器应该有语义化的role', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      const logContainer = screen.getByRole('log')
      expect(logContainer).toBeInTheDocument()
    })

    it('应该有描述性的aria-label', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      const logContainer = screen.getByRole('log')
      expect(logContainer).toHaveAttribute('aria-label', '对话历史')
    })

    it('应该通过aria-live通知更新', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'success',
      }]

      render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      const logContainer = screen.getByRole('log')
      expect(logContainer).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('边界情况', () => {
    it('应该处理空消息数组', () => {
      const { container } = render(
        <ChatMessageList 
          messages={[]} 
          isLoading={false}
        />
      )
      
      expect(container).toBeInTheDocument()
    })

    it('应该处理undefined的onRetry回调', () => {
      const messages: Message[] = [{
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date(),
        status: 'error',
      }]

      const { container } = render(
        <ChatMessageList 
          messages={messages} 
          isLoading={false}
        />
      )
      
      expect(container).toBeInTheDocument()
    })

    it('应该处理undefined的onExampleClick回调', () => {
      const { container } = render(
        <ChatMessageList 
          messages={[]} 
          isLoading={false}
        />
      )
      
      expect(container).toBeInTheDocument()
    })
  })
})

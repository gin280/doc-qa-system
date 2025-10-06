/**
 * ChatInput Component 单元测试
 * Story 3.1: 问答界面与输入处理
 * 解决 QA Issue: TEST-001
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput组件', () => {
  const mockOnSend = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染输入框和发送按钮', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox', { name: /请输入您的问题/i })
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      expect(textarea).toBeInTheDocument()
      expect(button).toBeInTheDocument()
    })

    it('应该显示占位符文本', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByPlaceholderText('请输入您的问题...')
      expect(textarea).toBeInTheDocument()
    })

    it('应该显示自定义占位符', () => {
      render(<ChatInput onSend={mockOnSend} placeholder="请先选择文档..." />)
      
      const textarea = screen.getByPlaceholderText('请先选择文档...')
      expect(textarea).toBeInTheDocument()
    })
  })

  describe('输入验证 (AC2)', () => {
    it('输入为空时应该禁用发送按钮', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const button = screen.getByRole('button', { name: /发送问题/i })
      expect(button).toBeDisabled()
    })

    it('输入有效内容后应该启用发送按钮', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      await user.type(textarea, '这是一个测试问题')
      
      expect(button).not.toBeDisabled()
    })

    it('输入仅包含空格时应该禁用发送按钮', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      await user.type(textarea, '   ')
      
      expect(button).toBeDisabled()
    })

    it('超过1000字符时应该禁用发送按钮', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      const longText = 'a'.repeat(1001)
      await user.type(textarea, longText)
      
      expect(button).toBeDisabled()
    })
  })

  describe('字符计数 (AC2)', () => {
    it('应该显示字符计数', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      expect(screen.getByText('0/1000')).toBeInTheDocument()
    })

    it('应该实时更新字符计数', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '测试')
      
      expect(screen.getByText('2/1000')).toBeInTheDocument()
    })

    it('超过1000字符时应该显示警告', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const longText = 'a'.repeat(1001)
      await user.type(textarea, longText)
      
      expect(screen.getByText(/问题过长，请精简/i)).toBeInTheDocument()
      expect(screen.getByText('1001/1000')).toHaveClass('text-destructive')
    })
  })

  describe('快捷键功能 (AC2)', () => {
    it('按Enter键应该发送消息', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '测试问题{Enter}')
      
      expect(mockOnSend).toHaveBeenCalledWith('测试问题')
    })

    it('按Ctrl+Enter应该发送消息', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '测试问题')
      await user.keyboard('{Control>}{Enter}{/Control}')
      
      expect(mockOnSend).toHaveBeenCalledWith('测试问题')
    })

    it('按Shift+Enter应该换行而不发送', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '第一行{Shift>}{Enter}{/Shift}第二行')
      
      expect(mockOnSend).not.toHaveBeenCalled()
      expect(textarea).toHaveValue('第一行\n第二行')
    })

    it('应该显示快捷键提示', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      expect(screen.getByText(/按 Enter 发送/i)).toBeInTheDocument()
      expect(screen.getByText(/Shift\+Enter 换行/i)).toBeInTheDocument()
    })
  })

  describe('发送功能 (AC3)', () => {
    it('点击发送按钮应该调用onSend', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      await user.type(textarea, '测试问题')
      await user.click(button)
      
      expect(mockOnSend).toHaveBeenCalledWith('测试问题')
    })

    it('发送后应该清空输入框', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '测试问题{Enter}')
      
      expect(textarea).toHaveValue('')
    })

    it('发送后应该重置字符计数', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '测试问题{Enter}')
      
      expect(screen.getByText('0/1000')).toBeInTheDocument()
    })

    it('应该去除首尾空格后发送', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '  测试问题  {Enter}')
      
      expect(mockOnSend).toHaveBeenCalledWith('测试问题')
    })
  })

  describe('禁用状态 (AC3, AC5)', () => {
    it('disabled为true时应该禁用输入框和按钮', () => {
      render(<ChatInput onSend={mockOnSend} disabled />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      expect(textarea).toBeDisabled()
      expect(button).toBeDisabled()
    })

    it('isLoading为true时应该禁用输入框和按钮', () => {
      render(<ChatInput onSend={mockOnSend} isLoading />)
      
      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /发送问题/i })
      
      expect(textarea).toBeDisabled()
      expect(button).toBeDisabled()
    })

    it('isLoading为true时应该显示加载图标', () => {
      render(<ChatInput onSend={mockOnSend} isLoading />)
      
      // Lucide的Loader2图标会有animate-spin class
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('自动高度调整 (AC2)', () => {
    it('输入框应该有最小高度', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('min-h-[60px]')
    })

    it('输入框应该有最大高度', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('max-h-[120px]')
    })

    it('输入框应该禁用手动调整大小', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveClass('resize-none')
    })
  })

  describe('可访问性 (AC10)', () => {
    it('输入框应该有aria-label', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox', { name: /请输入您的问题/i })
      expect(textarea).toHaveAttribute('aria-label', '请输入您的问题')
    })

    it('发送按钮应该有aria-label', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const button = screen.getByRole('button', { name: /发送问题/i })
      expect(button).toHaveAttribute('aria-label', '发送问题')
    })

    it('字符计数应该有aria-live', () => {
      render(<ChatInput onSend={mockOnSend} />)
      
      const charCount = screen.getByText('0/1000')
      expect(charCount).toHaveAttribute('aria-live', 'polite')
    })

    it('警告消息应该有role=alert', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSend={mockOnSend} />)
      
      const textarea = screen.getByRole('textbox')
      const longText = 'a'.repeat(1001)
      await user.type(textarea, longText)
      
      const warning = screen.getByText(/问题过长，请精简/i)
      expect(warning).toHaveAttribute('role', 'alert')
    })
  })
})
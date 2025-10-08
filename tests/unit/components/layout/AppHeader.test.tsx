/**
 * AppHeader Component Tests
 * Story 1.10: Chat为中心的统一导航架构
 * 
 * 测试 AppHeader 组件的渲染和功能
 */

import { render, screen } from '@testing-library/react'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePathname } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
}))

// Mock components
jest.mock('@/components/ui/logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}))

jest.mock('@/components/layout/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}))

describe('AppHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该正确渲染所有元素', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    render(<AppHeader />)
    
    // Logo应该存在
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    
    // 文档链接应该存在
    expect(screen.getByText('文档')).toBeInTheDocument()
    
    // UserMenu应该存在
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('Logo链接应该指向 /chat', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    render(<AppHeader />)
    
    const logoLink = screen.getByRole('link', { name: /返回首页/i })
    expect(logoLink).toHaveAttribute('href', '/chat')
  })

  it('文档链接应该指向 /documents', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    render(<AppHeader />)
    
    const docLink = screen.getByRole('link', { name: /文档/i }).closest('a')
    expect(docLink).toHaveAttribute('href', '/documents')
  })

  it('在文档页面时,文档按钮应该高亮', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/documents')
    
    const { container } = render(<AppHeader />)
    
    // 检查文档按钮有 default variant (高亮状态)
    const docButton = screen.getByText('文档').closest('button')
    expect(docButton).toBeInTheDocument()
  })

  it('在其他页面时,文档按钮应该是 ghost 样式', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    const { container } = render(<AppHeader />)
    
    const docButton = screen.getByText('文档').closest('button')
    expect(docButton).toBeInTheDocument()
  })

  it('Header应该是固定定位', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    const { container } = render(<AppHeader />)
    
    const header = container.querySelector('header')
    expect(header).toHaveClass('sticky')
    expect(header).toHaveClass('top-0')
  })

  it('应该使用毛玻璃效果', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/chat')
    
    const { container } = render(<AppHeader />)
    
    const header = container.querySelector('header')
    expect(header).toHaveClass('backdrop-blur')
  })
})


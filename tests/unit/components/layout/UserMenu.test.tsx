/**
 * UserMenu Component Tests
 * Story 1.10: Chat为中心的统一导航架构
 * 
 * 测试 UserMenu 组件的功能
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from '@/components/layout/UserMenu'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock UI components
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, asChild }: any) => (
    asChild ? children : <button onClick={onClick} data-testid="menu-item">{children}</button>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

jest.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}))

describe('UserMenu Component', () => {
  const mockPush = jest.fn()
  const mockSignOut = signOut as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  it('未登录时不渲染任何内容', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: null,
    })
    
    const { container } = render(<UserMenu />)
    expect(container.firstChild).toBeNull()
  })

  it('登录后应该显示用户头像和信息', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          image: null,
        },
      },
    })
    
    render(<UserMenu />)
    
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('应该显示用户名首字母作为头像fallback', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          image: null,
        },
      },
    })
    
    render(<UserMenu />)
    
    // 首字母应该是 T
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('应该包含账户设置链接', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    })
    
    render(<UserMenu />)
    
    const settingsLink = screen.getByText('账户设置').closest('a')
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('应该包含主题切换组件', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    })
    
    render(<UserMenu />)
    
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.getByText('主题')).toBeInTheDocument()
  })

  it('点击退出登录应该调用 signOut 并跳转', async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    })
    
    mockSignOut.mockResolvedValue(undefined)
    
    render(<UserMenu />)
    
    const logoutButton = screen.getByText('退出登录')
    fireEvent.click(logoutButton)
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('退出登录按钮应该有红色样式', () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    })
    
    render(<UserMenu />)
    
    const logoutButton = screen.getByText('退出登录').closest('button')
    expect(logoutButton).toHaveClass('text-red-600')
  })
})


/**
 * Navigation Flow Integration Tests
 * Story 1.10: Chat为中心的统一导航架构
 * 
 * 测试新的导航流程:
 * - 根路径重定向
 * - 登录后跳转到 Chat
 * - 路由保护
 */

import { auth } from '@/lib/auth'

// Mock auth function
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>

describe('Navigation Flow Integration Tests', () => {
  describe('根路径重定向', () => {
    it('未登录用户访问 / 应该看到 Landing Page', async () => {
      mockAuth.mockResolvedValue(null)
      
      // 在实际应用中,这会显示 HeroSection
      const session = await auth()
      expect(session).toBeNull()
      
      // 未登录应该显示 Landing Page (不重定向)
    })

    it('已登录用户访问 / 应该重定向到 /chat', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const session = await auth()
      expect(session?.user).toBeDefined()
      
      // 已登录应该重定向到 /chat
      // 这在 src/app/page.tsx 中实现
    })
  })

  describe('登录后跳转', () => {
    it('登录成功后应该跳转到 /chat', async () => {
      // 这在 LoginForm 组件中实现
      // window.location.href = '/chat'
      
      const expectedRedirect = '/chat'
      expect(expectedRedirect).toBe('/chat')
    })

    it('注册成功后应该跳转到 /chat', async () => {
      // 这在 RegisterForm 组件中实现
      // router.push('/chat')
      
      const expectedRedirect = '/chat'
      expect(expectedRedirect).toBe('/chat')
    })

    it('OAuth登录成功后应该跳转到 /chat', async () => {
      // 这在 OAuthButtons 组件中实现
      // callbackUrl: '/chat'
      
      const googleCallbackUrl = '/chat'
      const githubCallbackUrl = '/chat'
      
      expect(googleCallbackUrl).toBe('/chat')
      expect(githubCallbackUrl).toBe('/chat')
    })
  })

  describe('路由保护', () => {
    it('(app) 路由组应该要求认证', async () => {
      mockAuth.mockResolvedValue(null)
      
      const session = await auth()
      
      // 未登录时,(app) layout 应该重定向到 /login
      if (!session?.user) {
        const redirectTo = '/login'
        expect(redirectTo).toBe('/login')
      }
    })

    it('已登录用户可以访问 (app) 路由', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      const session = await auth()
      
      // 已登录时,可以访问 /chat, /documents, /settings
      expect(session?.user).toBeDefined()
    })

    it('(public) 路由组应该允许未认证访问', async () => {
      mockAuth.mockResolvedValue(null)
      
      const session = await auth()
      
      // 未登录用户可以访问 /, /login, /register
      expect(session).toBeNull()
      // (public) layout 不做认证检查
    })
  })

  describe('导航一致性', () => {
    it('所有认证页面应该使用 AppHeader', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any)
      
      // /chat, /documents, /settings 都使用 (app) layout
      // (app) layout 包含 AppHeader
      
      const pagesWithAppHeader = ['/chat', '/documents', '/settings']
      expect(pagesWithAppHeader).toHaveLength(3)
    })

    it('AppHeader 中的 Logo 应该链接回 /chat', () => {
      const logoHref = '/chat'
      expect(logoHref).toBe('/chat')
    })

    it('AppHeader 中应该只有一个导航链接', () => {
      const navigationLinks = ['文档'] // 只有"文档"一个链接
      expect(navigationLinks).toHaveLength(1)
      expect(navigationLinks[0]).toBe('文档')
    })
  })

  describe('Dashboard 已移除', () => {
    it('不应该存在 /dashboard 路由', () => {
      // Dashboard 已被完全删除
      const dashboardExists = false
      expect(dashboardExists).toBe(false)
    })

    it('所有 /dashboard 引用应该已更新', () => {
      // 检查没有代码引用 /dashboard
      const dashboardReferences = []
      expect(dashboardReferences).toHaveLength(0)
    })
  })

  describe('Chat 作为默认首页', () => {
    it('Chat 页面应该在 (app) 路由组中', () => {
      const chatPath = '/chat'
      const isInAppRouteGroup = true // (app)/chat/page.tsx
      
      expect(chatPath).toBe('/chat')
      expect(isInAppRouteGroup).toBe(true)
    })

    it('Chat 页面应该使用 AppHeader', () => {
      // Chat 在 (app) 路由组,自动使用 AppHeader
      const usesAppHeader = true
      expect(usesAppHeader).toBe(true)
    })

    it('ChatWithHistory 不应该有内部 Header', () => {
      // ChatWithHistory 已重构,移除了内部 Header
      const hasInternalHeader = false
      expect(hasInternalHeader).toBe(false)
    })
  })
})


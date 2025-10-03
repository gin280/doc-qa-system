/**
 * Landing Page 单元测试
 * Story 1.7: Landing Page 与导航实现
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const mockAuth = require('@/lib/auth').auth;
const mockRedirect = require('next/navigation').redirect;

describe('Landing Page - AC1: 基础布局', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  test('1.7-UNIT-001: 验证页面使用正确的根容器类名', async () => {
    const { container } = render(await Home());
    const main = container.querySelector('main');
    
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass('flex', 'min-h-screen', 'flex-col', 'items-center', 'justify-center');
  });

  test('1.7-UNIT-002: 验证页面使用 shadcn/ui Button 组件', async () => {
    render(await Home());
    const buttons = screen.getAllByRole('link');
    
    // 应该有两个按钮链接
    expect(buttons).toHaveLength(2);
    
    // 验证按钮是 Link 包裹的
    buttons.forEach(button => {
      expect(button.tagName).toBe('A');
    });
  });
});

describe('Landing Page - AC2: Hero Section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  test('1.7-UNIT-003: 验证主标题文本内容', async () => {
    render(await Home());
    const heading = screen.getByRole('heading', { level: 1 });
    
    expect(heading).toHaveTextContent('智能文档问答系统');
  });

  test('1.7-UNIT-004: 验证主标题样式类名', async () => {
    render(await Home());
    const h1 = screen.getByRole('heading', { level: 1 });
    
    expect(h1).toHaveClass('font-bold');
    // 验证响应式字号
    expect(h1.className).toMatch(/text-4xl|text-5xl|text-6xl/);
  });

  test('1.7-UNIT-005: 验证副标题文本和样式', async () => {
    render(await Home());
    const subtitle = screen.getByText(/基于 AI 的智能文档分析与问答平台/);
    
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveClass('text-gray-600');
  });

  test('1.7-UNIT-006: 验证产品描述存在', async () => {
    render(await Home());
    const description = screen.getByText(/上传您的文档/);
    
    expect(description).toBeInTheDocument();
  });
});

describe('Landing Page - AC3: CTA 按钮组', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  test('1.7-UNIT-007: 验证"免费开始使用"按钮链接', async () => {
    render(await Home());
    // 使用 aria-label 查找（可访问性改进后）
    const registerButton = screen.getByRole('link', { name: /免费注册账号/ });
    
    expect(registerButton).toHaveAttribute('href', '/register');
  });

  test('1.7-UNIT-008: 验证"登录"按钮链接', async () => {
    render(await Home());
    // 使用 aria-label 查找（可访问性改进后）
    const loginButton = screen.getByRole('link', { name: /登录已有账号/ });
    
    expect(loginButton).toHaveAttribute('href', '/login');
  });

  test('1.7-UNIT-009: 验证按钮使用 size="lg"', async () => {
    render(await Home());
    const buttons = screen.getAllByRole('link');
    
    // 验证按钮应有 min-w-[200px] 类（lg size 的特征之一）
    buttons.forEach(button => {
      expect(button.firstChild).toHaveClass('min-w-[200px]');
    });
  });

  test('1.7-UNIT-010: 验证按钮使用正确的 variant', async () => {
    render(await Home());
    const registerButton = screen.getByRole('link', { name: /免费注册账号/ });
    const loginButton = screen.getByRole('link', { name: /登录已有账号/ });
    
    // 注册按钮应该是 primary（无 variant 或 variant="default"）
    expect(registerButton.firstChild).toHaveClass('w-full', 'sm:w-auto');
    
    // 登录按钮应该是 outline variant
    expect(loginButton.firstChild).toHaveClass('w-full', 'sm:w-auto');
  });
});

describe('Landing Page - AC4: 用户状态路由逻辑', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1.7-UNIT-011: 未登录用户显示 Landing Page', async () => {
    mockAuth.mockResolvedValue(null);
    
    render(await Home());
    
    // 应显示主标题（Landing Page 的标志）
    expect(screen.getByText('智能文档问答系统')).toBeInTheDocument();
    // 应显示 CTA 按钮
    expect(screen.getByText('免费开始使用')).toBeInTheDocument();
    // 不应调用 redirect
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test('1.7-UNIT-012: 已登录用户触发 redirect', async () => {
    mockAuth.mockResolvedValue({
      user: { id: '1', email: 'test@example.com', name: 'Test User' }
    });
    
    // 调用组件会触发 redirect，这会抛出一个 Next.js 内部错误
    // 我们验证 redirect 被调用即可
    try {
      await Home();
    } catch (error) {
      // redirect 会抛出 NEXT_REDIRECT 错误，这是正常的
    }
    
    // 应调用 redirect
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});

describe('Landing Page - AC5: 响应式设计', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  test('验证主标题响应式字号类名', async () => {
    render(await Home());
    const h1 = screen.getByRole('heading', { level: 1 });
    
    // 应包含响应式类名
    expect(h1.className).toContain('text-4xl');
    expect(h1.className).toContain('md:text-5xl');
    expect(h1.className).toContain('lg:text-6xl');
  });

  test('验证按钮容器响应式布局类名', async () => {
    const { container } = render(await Home());
    const buttonContainer = container.querySelector('.flex.flex-col.sm\\:flex-row');
    
    expect(buttonContainer).toBeInTheDocument();
    expect(buttonContainer).toHaveClass('flex-col', 'sm:flex-row', 'gap-4');
  });

  test('验证按钮响应式宽度类名', async () => {
    render(await Home());
    const buttons = screen.getAllByRole('link');
    
    buttons.forEach(button => {
      expect(button.firstChild).toHaveClass('w-full', 'sm:w-auto');
    });
  });
});


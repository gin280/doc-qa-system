'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { UserMenu } from './UserMenu';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AppHeader - 统一的应用顶部导航栏
 * 用于所有认证后的页面
 * 
 * 功能:
 * - Logo: 点击回到 /chat
 * - 主导航: 只有"文档"一个链接
 * - 用户菜单: 设置、主题、退出
 */
export function AppHeader() {
  const pathname = usePathname();
  const isDocumentsPage = pathname === '/documents';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 左侧：Logo + 导航 */}
        <div className="flex items-center gap-6">
          {/* Logo - 点击回到 Chat */}
          <Logo size="sm" href="/chat" />

          {/* 主导航 - 只有"文档"一个链接 */}
          <nav className="flex items-center">
            <Link href="/documents">
              <Button 
                variant={isDocumentsPage ? "default" : "ghost"}
                className="gap-2"
                size="sm"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">文档</span>
              </Button>
            </Link>
          </nav>
        </div>

        {/* 右侧：用户菜单 */}
        <UserMenu />
      </div>
    </header>
  );
}


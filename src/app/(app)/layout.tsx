import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';

/**
 * App Layout - 认证保护的应用布局
 * 
 * 功能:
 * - 认证保护: 未登录用户重定向到登录页
 * - 统一顶部导航: AppHeader
 * - 适用于所有认证后的页面: /chat, /documents, /settings
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  // 未登录用户重定向到登录页
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 统一的顶部导航 */}
      <AppHeader />
      
      {/* 页面内容区域 */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}


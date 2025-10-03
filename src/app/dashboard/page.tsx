import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // 从数据库获取用户完整信息（包括头像）
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email!))
    .limit(1);

  // 获取用户名首字母作为 fallback
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Logo和主题切换 */}
        <div className="flex justify-between items-center mb-6">
          <Logo size="sm" />
          <ThemeToggle />
        </div>

        <div className="bg-card rounded-lg shadow p-6">
          {/* 顶部导航栏 */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              {/* 用户头像 */}
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={user?.avatarUrl || undefined} 
                  alt={user?.name || '用户头像'} 
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              
              {/* 用户信息 */}
              <div>
                <h1 className="text-2xl font-bold">欢迎回来, {user?.name}!</h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            
            {/* 退出按钮 */}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <Button type="submit" variant="outline">
                退出登录
              </Button>
            </form>
          </div>

          {/* 主要内容区域 */}
          <div className="space-y-4">
            <p className="text-muted-foreground">
              您已成功登录到智能文档问答系统
            </p>
            
            {/* 用户详细信息卡片 */}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-semibold text-foreground mb-3">
                账户信息
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">用户 ID:</span>
                  <span className="text-sm text-foreground font-mono">{user?.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">邮箱:</span>
                  <span className="text-sm text-foreground">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">用户名:</span>
                  <span className="text-sm text-foreground">{user?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">认证方式:</span>
                  <span className="text-sm text-foreground">
                    {user?.authProvider === 'GOOGLE' && '🔵 Google'}
                    {user?.authProvider === 'GITHUB' && '⚫ GitHub'}
                    {user?.authProvider === 'EMAIL' && '📧 邮箱密码'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-20">账户状态:</span>
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {user?.status === 'active' ? '✓ 正常' : user?.status}
                  </span>
                </div>
              </div>
            </div>

            {/* OAuth 用户提示 */}
            {user?.authProvider !== 'EMAIL' && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ 您正在使用 {user?.authProvider === 'GOOGLE' ? 'Google' : 'GitHub'} 账号登录，
                  头像已自动同步
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


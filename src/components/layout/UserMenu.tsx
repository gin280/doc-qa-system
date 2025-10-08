'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Palette } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * UserMenu - 用户菜单组件
 * 显示在 AppHeader 右侧
 * 
 * 功能:
 * - 显示用户头像和信息
 * - 账户设置链接
 * - 主题切换
 * - 退出登录
 */
export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const userInitial = user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 rounded-full"
          aria-label="用户菜单"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.image || undefined} alt={user.name || '用户'} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {userInitial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || '用户'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* 账户设置 */}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>账户设置</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* 主题切换 */}
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Palette className="mr-2 h-4 w-4" />
              <span className="text-sm">主题</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* 退出登录 */}
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


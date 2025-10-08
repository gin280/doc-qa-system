/**
 * Settings Page - 账户设置页面
 * Story 1.6: 用户账户管理
 * 
 * 功能:
 * - 个人信息编辑
 * - 密码修改
 * - 使用统计
 * - 账户删除
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AccountSettings } from '@/components/settings/AccountSettings'
import { UsageStats } from '@/components/settings/UsageStats'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: '账户设置 - DocQA',
  description: '管理您的账户设置'
}

/**
 * 加载状态组件
 */
function SettingsLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在加载设置...</p>
      </div>
    </div>
  )
}

/**
 * 账户设置页面
 */
export default async function SettingsPage() {
  // 验证用户登录状态
  const session = await auth()
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/settings')
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">账户设置</h1>
        <p className="text-muted-foreground mt-2">
          管理您的个人信息和账户设置
        </p>
      </div>

      <Suspense fallback={<SettingsLoading />}>
        <div className="space-y-6">
          <AccountSettings />
          <UsageStats />
        </div>
      </Suspense>
    </div>
  )
}


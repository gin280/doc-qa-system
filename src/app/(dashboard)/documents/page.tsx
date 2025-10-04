'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Upload, FileText, LogOut, User, Settings } from 'lucide-react'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { signOut, useSession } from 'next-auth/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'

export default function DocumentsPage() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const { data: session } = useSession()
  
  const userInitial = session?.user?.name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Logo size="sm" />
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-4">
              {/* 主题切换 */}
              <ThemeToggle />

              {/* 用户菜单 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>账户信息</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>设置</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto p-6 max-w-6xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">文档管理</h1>
          <p className="text-muted-foreground mt-1">
            上传和管理您的文档，开始智能问答
          </p>
        </div>
        <Button 
          onClick={() => setUploadModalOpen(true)}
          size="lg"
          className="gap-2"
        >
          <Upload className="h-5 w-5" />
          上传文档
        </Button>
      </div>

      {/* 空状态 */}
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              还没有文档
            </h2>
            <p className="text-muted-foreground max-w-md">
              上传您的第一个文档开始使用智能问答系统。
              支持 PDF、Word、Markdown 和 TXT 格式。
            </p>
          </div>

          <Button 
            onClick={() => setUploadModalOpen(true)}
            size="lg"
            className="mt-4"
          >
            <Upload className="h-5 w-5 mr-2" />
            上传文档
          </Button>

          {/* 功能说明 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t w-full">
            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">快速上传</h3>
              <p className="text-sm text-muted-foreground">
                支持拖拽或点击上传，最多 10 个文件
              </p>
            </div>

            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-foreground">多格式支持</h3>
              <p className="text-sm text-muted-foreground">
                PDF、Word、Markdown、TXT 格式
              </p>
            </div>

            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-foreground">智能处理</h3>
              <p className="text-sm text-muted-foreground">
                自动解析和向量化，随时问答
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 上传模态框 */}
      <DocumentUploadModal 
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
      </main>
    </div>
  )
}


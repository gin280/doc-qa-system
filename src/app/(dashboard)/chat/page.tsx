/**
 * Chat Page - 问答主页面
 * Story 3.1: 问答界面与输入处理
 * Story 3.5: 对话历史管理
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ChatWithHistory } from '@/components/chat/ChatWithHistory'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: '智能问答 - DocQA',
  description: '向AI提问，快速获取文档中的信息'
}

/**
 * 加载状态组件
 */
function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在加载问答界面...</p>
      </div>
    </div>
  )
}

/**
 * 问答页面客户端组件
 */
async function ChatPageContent({
  searchParams
}: {
  searchParams: { docId?: string }
}) {
  return (
    <ChatWithHistory initialDocumentId={searchParams.docId} />
  )
}

/**
 * 问答页面
 */
export default async function ChatPage({
  searchParams
}: {
  searchParams: { docId?: string }
}) {
  // 验证用户登录状态
  const session = await auth()
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/chat')
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <Suspense fallback={<ChatLoading />}>
        <ChatPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

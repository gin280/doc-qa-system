import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChatWithHistory } from '@/components/chat/ChatWithHistory';

/**
 * Chat Page - 默认首页
 * 
 * 这是应用的核心页面，用户登录后直接进入
 * 提供完整的对话功能和文档选择
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: { doc?: string };
}) {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  const initialDocumentId = searchParams.doc;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatWithHistory initialDocumentId={initialDocumentId} />
    </div>
  );
}


import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '智能文档问答系统 - 基于 AI 的文档分析平台',
  description: '基于 AI 的智能文档分析与问答平台，上传您的文档，让 AI 帮您快速找到答案，提升工作效率。',
  keywords: ['文档问答', 'AI', '智能分析', '文档管理', 'QA系统'],
  openGraph: {
    title: '智能文档问答系统',
    description: '基于 AI 的智能文档分析与问答平台',
    type: 'website',
  },
};

export default async function Home() {
  // 检查用户登录状态
  const session = await auth();
  
  // 已登录用户跳转到 Dashboard
  if (session?.user) {
    redirect('/dashboard');
  }

  // 未登录用户显示 Landing Page with Hero Animation
  return <HeroSection />;
}


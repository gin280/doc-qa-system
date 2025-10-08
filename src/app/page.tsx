import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/components/landing/hero-section'

/**
 * Home Page - 根路径智能重定向
 * 
 * 逻辑:
 * - 已登录用户 → 跳转到 /chat (默认首页)
 * - 未登录用户 → 显示 Landing Page
 */
export default async function Home() {
  const session = await auth()
  
  // 已登录用户直接跳转到 Chat
  if (session?.user) {
    redirect('/chat')
  }

  // 未登录用户显示 Landing Page
  return <HeroSection />
}

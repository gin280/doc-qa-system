import { createClient } from '@supabase/supabase-js'

/**
 * 客户端Supabase实例(浏览器使用)
 * 使用Anon Key,受RLS规则保护
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * 服务端Supabase实例(API Routes使用)
 * 使用Service Role Key,绕过RLS
 * 注意: 仅在服务端使用,永远不要暴露给客户端
 */
// 运行时检查：确保Service Role Key永远不会在浏览器端使用
if (typeof window !== 'undefined') {
  throw new Error('Service Role Key cannot be used in browser. Use supabase client instead.')
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * 从用户Session创建Supabase客户端
 * 用于需要用户上下文的Storage操作
 */
export function getSupabaseWithAuth(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  )
}


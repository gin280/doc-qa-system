/**
 * Embedding 缓存监控API
 * Story 4.2
 * 
 * GET /api/monitoring/embedding-cache
 * 返回缓存统计信息: 命中率、内存占用、缓存键数量等
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { embeddingCache } from '@/services/rag/embeddingCache'

/**
 * GET /api/monitoring/embedding-cache
 * 获取 Embedding 缓存统计信息
 * 
 * 认证: 需要登录
 * TODO: 添加管理员权限检查
 */
export async function GET() {
  // 1. 认证检查
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: 添加管理员权限检查
  // if (session.user.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // }

  try {
    // 2. 获取缓存统计
    const stats = await embeddingCache.getStats()

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Monitoring API] Failed to get cache stats:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, userUsage } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

// GET /api/user/usage - 获取使用量统计
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 查询用户 ID
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 查询使用量
    const [usage] = await db
      .select()
      .from(userUsage)
      .where(eq(userUsage.userId, user.id))
      .limit(1)

    // 添加限额信息(可从配置文件读取,这里硬编码)
    const limits = {
      documentLimit: 50,
      storageLimit: 1 * 1024 * 1024 * 1024, // 1GB in bytes
      queryLimit: 1000
    }

    // 如果不存在,返回默认值
    if (!usage) {
      return NextResponse.json({
        id: '',
        userId: user.id,
        documentCount: 0,
        storageUsed: 0,
        queryCount: 0,
        queryResetDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...limits
      })
    }

    return NextResponse.json({
      ...usage,
      queryResetDate: usage.queryResetDate.toISOString(),
      updatedAt: usage.updatedAt.toISOString(),
      ...limits
    })
  } catch (error) {
    console.error('Get usage error:', error)
    return NextResponse.json({ error: '获取使用量失败' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// GET /api/user/profile - 获取用户信息
export async function GET() {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        authProvider: users.authProvider,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 })
  }
}

// PATCH /api/user/profile - 更新用户名
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()

    const updateSchema = z.object({
      name: z.string().min(2, '用户名至少2个字符').max(50, '用户名最多50个字符')
    })

    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { name } = validation.data

    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        updatedAt: new Date()
      })
      .where(eq(users.email, session.user.email))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        authProvider: users.authProvider,
        createdAt: users.createdAt,
      })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: '更新用户信息失败' }, { status: 500 })
  }
}


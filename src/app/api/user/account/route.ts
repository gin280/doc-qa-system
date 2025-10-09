import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit-advanced'

const deleteLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500
})

// DELETE /api/user/account - 删除账户
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // Rate limiting
    try {
      await deleteLimiter.check(session.user.email, 1)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作过于频繁,请1小时后再试'
      return NextResponse.json(
        { error: errorMessage },
        { status: 429 }
      )
    }

    const body = await request.json()

    const deleteSchema = z.object({
      email: z.string().email('邮箱格式不正确')
    })

    const validation = deleteSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { email } = validation.data

    // 验证邮箱匹配
    if (email !== session.user.email) {
      return NextResponse.json(
        { error: '邮箱不匹配' },
        { status: 400 }
      )
    }

    // 删除用户(级联删除相关数据)
    await db
      .delete(users)
      .where(eq(users.email, email))

    // 返回 204 No Content
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: '删除账户失败' }, { status: 500 })
  }
}


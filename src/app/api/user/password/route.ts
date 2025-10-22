import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { rateLimit } from '@/lib/rate-limit-advanced'
import { changePasswordSchema } from '@/lib/validations/auth'
import { logger } from '@/lib/logger'

const passwordLimiter = rateLimit({
  interval: 5 * 60 * 1000, // 5 minutes
  uniqueTokenPerInterval: 500
})

// PATCH /api/user/password - 修改密码
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // Rate limiting
    try {
      await passwordLimiter.check(session.user.email, 3)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '操作过于频繁,请5分钟后再试'
      return NextResponse.json(
        { error: errorMessage },
        { status: 429 }
      )
    }

    const body = await request.json()

    // 使用统一的密码验证schema，但需要适配字段名
    // changePasswordSchema使用confirmNewPassword，但前端传的是confirmPassword
    const adaptedBody = {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmPassword // 适配字段名
    }

    const validation = changePasswordSchema.safeParse(adaptedBody)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // 查询用户
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1)

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'OAuth 用户无法修改密码' },
        { status: 400 }
      )
    }

    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: '当前密码错误' },
        { status: 401 }
      )
    }

    // 哈希新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // 更新密码
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id))

    return NextResponse.json({ message: '密码修改成功' })
  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Change password error:')
    return NextResponse.json({ error: '密码修改失败' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { db } from '@/lib/db'
import { users, userUsage } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { registerApiSchema } from '@/lib/validations/auth'

// 注册请求验证 Schema - 使用后端专用的验证规则
// 不包含 confirmPassword (前端已验证), 用户名允许空格

export async function POST(req: NextRequest) {
  try {
    // 0. 速率限制检查 (每 IP 每小时 5 次)
    const clientIp = getClientIp(req)
    const rateLimitResult = checkRateLimit(`register:${clientIp}`, {
      windowMs: 60 * 60 * 1000, // 1 小时
      max: 5, // 最多 5 次请求
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
          retryAfter: rateLimitResult.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
            'Retry-After': Math.ceil(
              (rateLimitResult.reset.getTime() - Date.now()) / 1000
            ).toString(),
          },
        }
      )
    }

    // 1. 验证请求体
    const body = await req.json()
    const validData = registerApiSchema.parse(body)

    // 2. 检查邮箱是否已存在
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, validData.email))

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      )
    }

    // 3. 哈希密码 (salt rounds = 10, 符合 PRD 要求)
    const passwordHash = await bcrypt.hash(validData.password, 10)

    // 4. 使用事务创建用户和初始化 UserUsage (修复 REL-001)
    const result = await db.transaction(async (tx) => {
      // 创建用户
      const [newUser] = await tx
        .insert(users)
        .values({
          email: validData.email,
          passwordHash,
          name: validData.name,
          authProvider: 'EMAIL',
        })
        .returning()

      // 初始化 UserUsage 记录
      await tx.insert(userUsage).values({
        userId: newUser.id,
        documentCount: 0,
        storageUsed: 0,
        queryCount: 0,
      })

      return newUser
    })

    // 5. 返回成功响应（不返回密码哈希）
    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
        },
      }
    )
  } catch (error) {
    // Zod 验证错误
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: '输入验证失败',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    // 其他错误
    console.error('注册失败:', error)
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}



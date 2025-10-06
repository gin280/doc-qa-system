/**
 * Chat Query API - 问答查询端点
 * Story 3.1: 问答界面与输入处理
 * 
 * 本Story仅实现输入验证和权限检查
 * Story 3.2将添加向量检索
 * Story 3.3将添加LLM回答生成
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/chat/query
 * 提交问答请求
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    // 2. 速率限制
    const rateLimitResult = await rateLimit(session.user.id, 'chat')
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: '请求过于频繁，请稍后再试',
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      )
    }

    // 3. 解析请求体
    const body = await req.json()
    const { documentId, question, conversationId } = body

    // 4. 输入验证
    if (!documentId) {
      return NextResponse.json(
        { error: '缺少documentId参数' },
        { status: 400 }
      )
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: '问题不能为空' },
        { status: 400 }
      )
    }

    const trimmedQuestion = question.trim()
    if (trimmedQuestion.length === 0) {
      return NextResponse.json(
        { error: '问题不能为空' },
        { status: 400 }
      )
    }

    if (trimmedQuestion.length > 1000) {
      return NextResponse.json(
        { error: '问题过长，请精简（最多1000字符）' },
        { status: 400 }
      )
    }

    // 5. 验证文档存在且用户有权访问
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.userId, session.user.id)
        )
      )
      .limit(1)

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 6. 验证文档已就绪
    if (document.status !== 'READY') {
      return NextResponse.json(
        { 
          error: '文档尚未处理完成，请稍候',
          documentStatus: document.status 
        },
        { status: 400 }
      )
    }

    // 7. 验证文档已向量化
    if (!document.vectorized) {
      return NextResponse.json(
        { error: '文档尚未向量化，无法进行问答' },
        { status: 400 }
      )
    }

    // ============================================
    // Story 3.2 将在此处添加:
    // - 向量检索逻辑
    // - 检索相关文档片段
    // 
    // Story 3.3 将在此处添加:
    // - LLM调用
    // - 流式响应生成
    // - 引用信息返回
    // ============================================

    // 本Story仅返回占位响应
    return NextResponse.json({
      success: true,
      message: 'API验证通过，回答生成将在Story 3.3实现',
      data: {
        conversationId: conversationId || 'new',
        documentId,
        question: trimmedQuestion,
        documentTitle: document.filename,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Chat query error:', error)
    return NextResponse.json(
      { 
        error: '服务器错误，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chat/query
 * 不支持GET请求
 */
export async function GET() {
  return NextResponse.json(
    { error: '不支持GET请求，请使用POST' },
    { status: 405 }
  )
}

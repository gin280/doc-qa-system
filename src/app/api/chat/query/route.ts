/**
 * Chat Query API - 问答查询端点
 * Story 3.1: 问答界面与输入处理
 * Story 3.2: RAG向量检索实现 ✅
 * Story 3.3: LLM回答生成（待实现）
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { retrievalService, RetrievalError } from '@/services/rag/retrievalService'
import { QueryVectorizationError } from '@/services/rag/queryVectorizer'

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

    // 2. 速率限制（30次/分钟）
    const rateLimitKey = `chat-query:${session.user.id}`
    const rateLimitResult = checkRateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1分钟
      max: 30
    })
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: '请求过于频繁，请稍后再试',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
            'Retry-After': '60'
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

    // 6. 验证文档已就绪（READY状态表示已完成解析、分块和向量化）
    if (document.status !== 'READY') {
      return NextResponse.json(
        { 
          error: '文档尚未处理完成，请稍候',
          documentStatus: document.status 
        },
        { status: 400 }
      )
    }

    // 7. 验证文档有chunks（双重检查向量化已完成）
    if (document.chunksCount === 0) {
      return NextResponse.json(
        { error: '文档尚未向量化，无法进行问答' },
        { status: 400 }
      )
    }

    // ============================================
    // Story 3.2: RAG向量检索 ✅
    // ============================================
    
    const retrievalStartTime = Date.now()
    
    try {
      // 执行RAG检索
      const retrieval = await retrievalService.retrieveContext(
        trimmedQuestion,
        documentId,
        session.user.id,
        {
          topK: 5,
          minScore: 0.3,  // 余弦相似度阈值：0.3可以召回相关内容同时过滤无关内容
          useCache: true
        }
      )

      const totalTime = Date.now() - retrievalStartTime

      // 返回检索结果（临时格式，Story 3.3将改为流式LLM响应）
      return NextResponse.json({
        success: true,
        conversationId: conversationId || 'new',
        retrieval: {
          chunks: retrieval.chunks.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            score: chunk.score,
            chunkIndex: chunk.chunkIndex,
            metadata: chunk.metadata
          })),
          totalFound: retrieval.totalFound,
          cached: retrieval.cached,
          retrievalTime: retrieval.retrievalTime
        },
        message: 'RAG检索完成。LLM回答生成将在Story 3.3实现。',
        debug: process.env.NODE_ENV === 'development' ? {
          totalTime: `${totalTime}ms`,
          documentTitle: document.filename
        } : undefined
      })
    } catch (retrievalError) {
      // 处理检索特定错误
      return handleRetrievalError(retrievalError)
    }

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
 * 处理检索错误
 */
function handleRetrievalError(error: unknown): NextResponse {
  // 安全地提取错误信息
  const errorName = error && typeof error === 'object' && 'name' in error ? (error as Error).name : 'Unknown'
  const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : undefined
  const errorMessage = error instanceof Error ? error.message : String(error)
  
  console.error('[ChatQuery] Retrieval error:', {
    name: errorName,
    code: errorCode,
    message: errorMessage
  })

  // 查询向量化错误
  if (error instanceof QueryVectorizationError) {
    switch (error.code) {
      case 'EMBEDDING_TIMEOUT':
        return NextResponse.json(
          { error: '查询处理超时，请重试' },
          { status: 504 }
        )
      case 'QUOTA_EXCEEDED':
      case 'RATE_LIMIT_EXCEEDED':
        return NextResponse.json(
          { error: '今日查询次数已达上限，请明天再试' },
          { status: 429 }
        )
      case 'INVALID_INPUT':
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
      default:
        return NextResponse.json(
          { error: 'AI服务暂时不可用，请稍后重试' },
          { status: 503 }
        )
    }
  }

  // 检索错误
  if (error instanceof RetrievalError) {
    switch (error.code) {
      case 'DOCUMENT_NOT_FOUND':
        return NextResponse.json(
          { error: '文档不存在或无权访问' },
          { status: 404 }
        )
      case 'DOCUMENT_NOT_READY':
        return NextResponse.json(
          { error: '文档尚未处理完成，请稍候' },
          { status: 400 }
        )
      case 'NO_RELEVANT_CONTENT':
        return NextResponse.json(
          { 
            error: '未找到相关内容，请尝试换个问法',
            suggestion: '提示：尝试使用更具体的关键词或换个角度提问'
          },
          { status: 200 }
        )
      case 'INVALID_QUERY':
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
      default:
        return NextResponse.json(
          { error: '检索服务暂时不可用，请稍后重试' },
          { status: 503 }
        )
    }
  }

  // 其他未知错误
  return NextResponse.json(
    { 
      error: '服务器错误，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    },
    { status: 500 }
  )
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

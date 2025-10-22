/**
 * Chat Query API - 问答查询端点
 * Story 3.1: 问答界面与输入处理 ✅
 * Story 3.2: RAG向量检索实现 ✅
 * Story 3.3: LLM回答生成与流式输出 ✅
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { retrievalService, RetrievalError } from '@/services/rag/retrievalService'
import { QueryVectorizationError } from '@/services/rag/queryVectorizer'
import { answerService } from '@/services/rag/answerService'
import { conversationService } from '@/services/chat/conversationService'
import { usageService } from '@/services/user/usageService'
import { getErrorMessage as getErrorMessageUtil } from '@/types/errors'
import { logger } from '@/lib/logger'

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
    // Story 3.3: 用户限额检查 ✅
    // ============================================
    const quotaCheck = await usageService.checkQuotaLimit(session.user.id, 100) // 日限额100次
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: '您的查询次数已达今日上限，请明天再试' },
        { status: 429 }
      )
    }

    // ============================================
    // Story 3.2: RAG向量检索 ✅
    // ============================================
    const retrievalStartTime = Date.now()
    
    let retrieval
    try {
      // 执行RAG检索
      retrieval = await retrievalService.retrieveContext(
        trimmedQuestion,
        documentId,
        session.user.id,
        {
          topK: 5,
          minScore: 0.3,  // 余弦相似度阈值：0.3可以召回相关内容同时过滤无关内容
          useCache: true
        }
      )
    } catch (retrievalError) {
      // 处理检索特定错误
      return handleRetrievalError(retrievalError)
    }

    // 检查检索结果
    if (retrieval.chunks.length === 0) {
      return NextResponse.json(
        {
          error: '未找到相关内容',
          suggestion: '请尝试换个问法或上传更多相关文档'
        },
        { status: 200 }
      )
    }

    // ============================================
    // Story 3.3: 创建或获取对话 ✅
    // ============================================
    let currentConversationId = conversationId
    
    // 如果没有提供conversationId，创建新对话
    if (!currentConversationId) {
      const conversation = await conversationService.createConversation(
        session.user.id,
        documentId,
        trimmedQuestion.substring(0, 50) // 使用问题前50字作为标题
      )
      currentConversationId = conversation.id
    } else {
      // 如果提供了conversationId，验证其是否存在且属于当前用户
      try {
        await conversationService.getConversation(currentConversationId, session.user.id)
      } catch (error) {
        // 对话不存在或无权访问，创建新对话
        logger.warn({
          providedId: currentConversationId,
          error: error instanceof Error ? error.message : String(error),
          action: 'invalid_conversation_id'
        }, '[ChatQuery] Invalid conversationId, creating new conversation')
        const conversation = await conversationService.createConversation(
          session.user.id,
          documentId,
          trimmedQuestion.substring(0, 50)
        )
        currentConversationId = conversation.id
      }
    }

    // 保存用户消息
    await conversationService.createUserMessage(currentConversationId, trimmedQuestion)

    // ============================================
    // Story 3.3: 流式生成AI回答 ✅
    // ============================================
    const encoder = new TextEncoder()
    let fullAnswer = ''

    const stream = new ReadableStream({
      async start(controller) {
        const generationStartTime = Date.now()
        try {
          // 生成回答流
          const answerStream = answerService.generateAnswer(
            trimmedQuestion,
            retrieval,
            currentConversationId,
            {
              temperature: 0.1,
              maxTokens: 500,
              includeHistory: true
            }
          )

          // 流式发送每个chunk
          for await (const chunk of answerStream) {
            fullAnswer += chunk
            controller.enqueue(encoder.encode(chunk))
          }

          const generationTime = Date.now() - generationStartTime
          
          // 监控日志：成功生成
          logger.info({
            timestamp: new Date().toISOString(),
            userId: session.user.id,
            conversationId: currentConversationId,
            generationTimeMs: generationTime,
            answerLength: fullAnswer.length,
            tokensEstimate: Math.ceil(fullAnswer.length / 4),
            action: 'llm_generation_success'
          }, '[MONITOR] LLM generation success')

          // 回答生成完毕，保存到数据库（异步，不阻塞响应）
          conversationService.createAssistantMessage(
            currentConversationId!,
            fullAnswer,
            [] // citations将在Story 3.4实现
          ).catch(err => {
            logger.error({ error: err, action: 'save_assistant_message_error' }, 'Failed to save assistant message')
          })

          // 更新使用量统计（异步，不阻塞响应）
          usageService.incrementQueryCount(session.user.id).catch(err => {
            logger.error({ error: err, userId: session.user.id, action: 'update_usage_error' }, 'Failed to update usage')
          })

          controller.close()

        } catch (error: unknown) {
          const generationTime = Date.now() - generationStartTime
          const errorMsg = getErrorMessageUtil(error)
          
          // 监控日志：生成失败
          logger.error({
            timestamp: new Date().toISOString(),
            userId: session.user.id,
            conversationId: currentConversationId,
            error: errorMsg,
            generationTimeMs: generationTime,
            errorType: errorMsg.includes('timeout') ? 'TIMEOUT' : 
                       errorMsg.includes('quota') ? 'QUOTA' : 'UNKNOWN',
            action: 'llm_generation_failed'
          }, '[MONITOR] LLM generation failed')
          
          // 流式错误处理
          const errorMessage = getErrorMessage(error)
          controller.enqueue(encoder.encode(`\n\n[错误: ${errorMessage}]`))
          controller.close()
        }
      }
    })

    const totalTime = Date.now() - retrievalStartTime
    
    // 增强的监控日志（用于告警系统）
    logger.info({
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      documentId,
      conversationId: currentConversationId,
      questionLength: trimmedQuestion.length,
      retrievalTime: `${retrieval.retrievalTime}ms`,
      chunksRetrieved: retrieval.chunks.length,
      totalTime: `${totalTime}ms`,
      remainingQuota: quotaCheck.remaining,
      // 用于监控告警的指标
      metrics: {
        retrievalTimeMs: retrieval.retrievalTime,
        totalTimeMs: totalTime,
        chunksCount: retrieval.chunks.length
      },
      action: 'chat_query_streaming_started'
    }, '[MONITOR] Chat query streaming started')

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': currentConversationId
      }
    })

  } catch (error) {
    logger.error({ error, action: 'chat_query_error' }, 'Chat query error')
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
  
  logger.error({
    name: errorName,
    code: errorCode,
    message: errorMessage,
    action: 'retrieval_error'
  }, '[ChatQuery] Retrieval error')

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
 * 错误消息映射（用于流式响应）
 */
function getErrorMessage(error: unknown): string {
  const message = getErrorMessageUtil(error)
  
  switch (message) {
    case 'GENERATION_TIMEOUT':
      return '回答生成超时，请重试'
    case 'QUOTA_EXCEEDED':
      return 'AI服务配额已用尽'
    case 'GENERATION_ERROR':
      return 'AI服务暂时不可用'
    case 'CONVERSATION_NOT_FOUND':
      return '对话不存在'
    default:
      return '服务暂时不可用，请稍后重试'
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

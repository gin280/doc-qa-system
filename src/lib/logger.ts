/**
 * 结构化日志系统 - Pino + Axiom 集成
 * 
 * 环境策略:
 * - Development: pino-pretty 美化输出到控制台
 * - Production: 全部日志到 Vercel Logs, error/fatal 发送到 Axiom
 * 
 * 配额管理: MVP 阶段仅发送 error/fatal 级别,节省 Axiom 500GB 免费配额
 */

import pino from 'pino'

/**
 * 获取 Pino 传输配置
 */
function getTransportConfig() {
  // 生产环境: 发送 error/fatal 到 Axiom
  if (process.env.NODE_ENV === 'production' && process.env.AXIOM_TOKEN) {
    return {
      target: 'pino-axiom',
      options: {
        dataset: process.env.AXIOM_DATASET || 'docqa-system',
        token: process.env.AXIOM_TOKEN,
        orgId: process.env.AXIOM_ORG_ID,
        // MVP策略: 只发送重要日志,节省配额
        levels: ['error', 'fatal']
      }
    }
  }

  // 开发环境: pino-pretty 美化输出
  if (process.env.NODE_ENV === 'development') {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false
      }
    }
  }

  // 默认: 标准 JSON 输出
  return undefined
}

/**
 * 创建 Logger 实例
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(getTransportConfig() && {
    transport: getTransportConfig()
  })
})

/**
 * 结构化日志辅助函数
 */

// 文档上传日志
export const logDocumentUpload = (data: {
  userId: string
  documentId?: string
  fileName: string
  fileSize: number
  processingTime?: number
  success: boolean
  error?: string
}) => {
  const { success, ...logData } = data
  if (success) {
    logger.info(
      { ...logData, action: 'upload_success' },
      'Document uploaded successfully'
    )
  } else {
    logger.error(
      { ...logData, action: 'upload_error' },
      'Document upload failed'
    )
  }
}

// 文档解析日志
export const logDocumentParsing = (data: {
  documentId: string
  fileType: string
  contentLength?: number
  parseTime?: number
  success: boolean
  error?: string
}) => {
  const { success, ...logData } = data
  if (success) {
    logger.info(
      { ...logData, action: 'parse_success' },
      'Document parsing completed'
    )
  } else {
    logger.error(
      { ...logData, action: 'parse_error' },
      'Document parsing failed'
    )
  }
}

// 文档分块日志
export const logDocumentChunking = (data: {
  documentId: string
  chunksCount: number
  chunkTime?: number
  truncated?: boolean
  limit?: number
}) => {
  if (data.truncated) {
    logger.warn(
      { ...data, action: 'chunk_truncate' },
      'Document too large, chunks truncated'
    )
  } else {
    logger.info(
      { ...data, action: 'chunk_success' },
      'Document chunking completed'
    )
  }
}

// Embedding 日志
export const logEmbedding = (data: {
  documentId?: string
  batchSize: number
  embeddingTime: number
  success: boolean
  error?: string
  chunkId?: string
}) => {
  const { success, ...logData } = data
  if (success) {
    logger.info(
      { ...logData, action: 'embed_success' },
      'Embedding completed'
    )
  } else {
    logger.error(
      { ...logData, action: 'embed_error' },
      'Embedding failed'
    )
  }
}

// RAG 检索日志
export const logRetrieval = (data: {
  userId: string
  queryPreview: string  // 截断的查询文本 (max 100 chars)
  documentIds?: string[]
  chunksFound?: number
  retrievalTime?: number
  cacheHit?: boolean
  success: boolean
  error?: string
}) => {
  const { success, ...logData } = data
  if (success) {
    logger.info(
      { ...logData, action: 'retrieval_success' },
      'Retrieval completed'
    )
  } else {
    logger.error(
      { ...logData, action: 'retrieval_error' },
      'Retrieval failed'
    )
  }
}

// Answer 生成日志
export const logAnswerGeneration = (data: {
  userId: string
  tokensUsed?: number
  generationTime?: number
  success: boolean
  error?: string
}) => {
  const { success, ...logData } = data
  if (success) {
    logger.info(
      { ...logData, action: 'generation_success' },
      'Answer generated'
    )
  } else {
    logger.error(
      { ...logData, action: 'generation_error' },
      'Answer generation failed'
    )
  }
}

// 缓存日志
export const logCache = (data: {
  cacheKey: string
  hit: boolean
  hitTime?: number
  missTime?: number
}) => {
  const { hit, ...logData } = data
  if (hit) {
    logger.info(
      { ...logData, action: 'cache_hit' },
      'Cache hit'
    )
  } else {
    logger.info(
      { ...logData, action: 'cache_miss' },
      'Cache miss'
    )
  }
}

// 验证告警日志
export const logValidationWarning = (data: {
  documentId?: string
  reason: string
  context?: Record<string, unknown>
}) => {
  logger.warn(
    { ...data, action: 'validation_warn' },
    'Validation warning'
  )
}

// 维度不匹配错误日志
export const logDimensionError = (data: {
  expected: number
  actual: number
  chunkId?: string
  context?: Record<string, unknown>
}) => {
  logger.error(
    { ...data, action: 'dimension_error' },
    'Vector dimension mismatch'
  )
}

// 通用错误日志
export const logError = (
  error: Error | unknown,
  context: Record<string, unknown>
) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  logger.error(
    {
      error: errorMessage,
      stack: errorStack,
      ...context
    },
    'Operation failed'
  )
}

// 查询预览 (截断敏感/长查询)
export const sanitizeQuery = (query: string, maxLength = 100): string => {
  if (query.length <= maxLength) {
    return query
  }
  return query.slice(0, maxLength) + '...'
}

// Email 脱敏
export const sanitizeEmail = (email: string): string => {
  return email.replace(/^(.)(.*)(@.*)$/, '$1***$3')
}

export default logger


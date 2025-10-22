/**
 * Logger 测试脚本
 * 用于验证 Pino + Axiom 日志集成是否正常工作
 */

import { logger, logDocumentUpload, logRetrieval, logCache, logError } from './logger'

async function testLogger() {
  console.log('🧪 Testing Pino Logger...\n')

  // 1. 测试基础日志级别
  console.log('1️⃣ Testing log levels:')
  logger.info('This is an info message')
  logger.warn('This is a warning message')
  logger.error('This is an error message')
  
  // 2. 测试结构化日志
  console.log('\n2️⃣ Testing structured logging:')
  logger.info({
    userId: 'test-user-123',
    action: 'test_action',
    metadata: { key: 'value' }
  }, 'Structured log message')

  // 3. 测试辅助函数
  console.log('\n3️⃣ Testing helper functions:')
  
  // 文档上传日志
  logDocumentUpload({
    userId: 'test-user-123',
    documentId: 'doc-456',
    fileName: 'test.pdf',
    fileSize: 1024000,
    processingTime: 1500,
    success: true
  })

  // RAG 检索日志
  logRetrieval({
    userId: 'test-user-123',
    queryPreview: 'What is the meaning of life?',
    documentIds: ['doc-456'],
    chunksFound: 5,
    retrievalTime: 250,
    cacheHit: false,
    success: true
  })

  // 缓存日志
  logCache({
    cacheKey: 'test-cache-key',
    hit: true,
    hitTime: 50
  })

  // 错误日志
  logError(new Error('Test error'), {
    userId: 'test-user-123',
    action: 'test_error'
  })

  console.log('\n✅ Logger test completed!')
  console.log('\n📝 Check output:')
  console.log('  - Development: Should see colorized output above')
  console.log('  - Production: Check Axiom Dashboard for error/fatal logs')
}

// 运行测试
testLogger().catch(console.error)


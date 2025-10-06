/**
 * RAG检索 API 集成测试
 * Story 3.2 - RAG向量检索实现
 * 
 * P0 Tests: 完整RAG检索流程验证
 * 
 * 测试范围：
 * - 完整API流程（权限验证、向量化、检索、缓存）
 * - 权限和安全（跨用户访问、文档状态）
 * - 错误处理（API失败、超时、无相关内容）
 * - 性能基准（延迟验证）
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { documents, users, documentChunks } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Session } from 'next-auth'
import { EMBEDDING_DIMENSION } from '@/config/llm.config'

// Import API route handler
import { POST } from '@/app/api/chat/query/route'

/**
 * Mock authenticated request
 */
function createAuthenticatedRequest(
  url: string, 
  userId: string, 
  body: any
): NextRequest {
  const mockSession: Session = {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
  
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Mock LLM Repository for embedding generation
 */
function mockLLMEmbedding() {
  const mockVector = new Array(EMBEDDING_DIMENSION).fill(0).map(() => Math.random())
  
  jest.spyOn(require('@/infrastructure/llm/llm-repository.factory').LLMRepositoryFactory, 'create')
    .mockReturnValue({
      generateEmbeddings: jest.fn().mockResolvedValue([mockVector])
    })
  
  return mockVector
}

describe('RAG Retrieval API Integration Tests', () => {
  let testUserId: string
  let testDocumentId: string
  let otherUserId: string

  beforeEach(async () => {
    testUserId = nanoid()
    otherUserId = nanoid()
    testDocumentId = nanoid()
    
    // Clean up existing test users
    await db.delete(users).where(eq(users.email, 'test@test.com'))
    await db.delete(users).where(eq(users.email, 'other@test.com'))
    
    // Create test users
    await db.insert(users).values([
      {
        id: testUserId,
        email: 'test@test.com',
        name: 'Test User'
      },
      {
        id: otherUserId,
        email: 'other@test.com',
        name: 'Other User'
      }
    ])
    
    // Create test document with READY status
    await db.insert(documents).values({
      id: testDocumentId,
      userId: testUserId,
      filename: 'test-document.pdf',
      fileSize: 1024 * 100, // 100KB
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${testDocumentId}.pdf`,
      status: 'READY',
      chunksCount: 5,
      contentLength: 5000,
      uploadedAt: new Date()
    })
    
    // Create test document chunks with embeddings
    const chunks = []
    for (let i = 0; i < 5; i++) {
      const chunkId = `chunk-${i}`
      chunks.push({
        id: chunkId,
        documentId: testDocumentId,
        chunkIndex: i,
        content: `This is test chunk ${i} about React Hooks and useState. React is a popular JavaScript library for building user interfaces.`,
        embeddingId: chunkId,
        metadata: {
          pageNumber: Math.floor(i / 2) + 1,
          section: `Section ${i}`
        }
      })
    }
    await db.insert(documentChunks).values(chunks)
    
    // TODO: 在实际测试环境中，需要为chunks插入真实的embedding向量
    // 这里假设Migration 0003的pgvector已经正确配置
  })

  afterEach(async () => {
    // Cleanup
    await db.delete(documentChunks)
    await db.delete(documents)
    await db.delete(users).where(eq(users.id, testUserId))
    await db.delete(users).where(eq(users.id, otherUserId))
    jest.restoreAllMocks()
  })

  // ============================================================================
  // P0-RAG-001: 完整RAG检索流程成功
  // ============================================================================
  describe('P0-RAG-001: Complete RAG Retrieval Flow', () => {
    it('Should successfully execute full RAG retrieval', async () => {
      // Mock LLM embedding generation
      mockLLMEmbedding()
      
      // Act: Call API with a test query
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: 'What is React Hooks?',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Assert: Success response
      expect(response.status).toBe(200)
      
      const data = await response.json()
      
      // Verify response structure
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('retrieval')
      expect(data.retrieval).toHaveProperty('chunks')
      expect(data.retrieval).toHaveProperty('totalFound')
      expect(data.retrieval).toHaveProperty('cached')
      expect(data.retrieval).toHaveProperty('retrievalTime')
      
      // Verify chunks structure
      expect(Array.isArray(data.retrieval.chunks)).toBe(true)
      if (data.retrieval.chunks.length > 0) {
        const chunk = data.retrieval.chunks[0]
        expect(chunk).toHaveProperty('id')
        expect(chunk).toHaveProperty('content')
        expect(chunk).toHaveProperty('score')
        expect(chunk).toHaveProperty('chunkIndex')
      }
    })

    it('Should respect Top-K parameter (default 5)', async () => {
      mockLLMEmbedding()
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      // Should return at most 5 chunks (Top-K=5)
      expect(data.retrieval.chunks.length).toBeLessThanOrEqual(5)
    })

    it('Should filter results by minScore threshold', async () => {
      mockLLMEmbedding()
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      // All chunks should have score >= minScore (0.3 default)
      data.retrieval.chunks.forEach((chunk: any) => {
        expect(chunk.score).toBeGreaterThanOrEqual(0.3)
      })
    })
  })

  // ============================================================================
  // P0-RAG-002: 权限和安全验证
  // ============================================================================
  describe('P0-RAG-002: Permission and Security', () => {
    it('Should reject access to other user document', async () => {
      mockLLMEmbedding()
      
      // Try to access testUser's document with otherUser's credentials
      const request = createAuthenticatedRequest('/api/chat/query', otherUserId, {
        documentId: testDocumentId, // testUser's document
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should be rejected
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('不存在或无权访问')
    })

    it('Should reject access to non-READY document', async () => {
      // Create a document with PROCESSING status
      const processingDocId = nanoid()
      await db.insert(documents).values({
        id: processingDocId,
        userId: testUserId,
        filename: 'processing.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storagePath: `documents/${testUserId}/${processingDocId}.pdf`,
        status: 'PROCESSING',
        chunksCount: 0,
        uploadedAt: new Date()
      })
      
      mockLLMEmbedding()
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: processingDocId,
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should be rejected
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('尚未处理完成')
      
      // Cleanup
      await db.delete(documents).where(eq(documents.id, processingDocId))
    })
  })

  // ============================================================================
  // P0-RAG-003: 错误处理
  // ============================================================================
  describe('P0-RAG-003: Error Handling', () => {
    it('Should handle LLM API failure gracefully', async () => {
      // Mock LLM failure
      jest.spyOn(require('@/infrastructure/llm/llm-repository.factory').LLMRepositoryFactory, 'create')
        .mockReturnValue({
          generateEmbeddings: jest.fn().mockRejectedValue(new Error('API Error'))
        })
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should return 503 (service unavailable)
      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.error).toContain('AI服务')
    })

    it('Should reject empty query', async () => {
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: '',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should return 400 (bad request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('Should reject query > 1000 characters', async () => {
      const longQuery = 'a'.repeat(1001)
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: longQuery,
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should return 400 (bad request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('过长')
    })

    it('Should reject missing documentId', async () => {
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        question: 'Test query',
        conversationId: null
      })
      
      const response = await POST(request)
      
      // Should return 400 (bad request)
      expect(response.status).toBe(400)
    })
  })

  // ============================================================================
  // P0-RAG-004: 性能验证（基础）
  // ============================================================================
  describe('P0-RAG-004: Basic Performance', () => {
    it('Should complete retrieval within reasonable time', async () => {
      mockLLMEmbedding()
      
      const start = Date.now()
      
      const request = createAuthenticatedRequest('/api/chat/query', testUserId, {
        documentId: testDocumentId,
        question: 'Test query for performance',
        conversationId: null
      })
      
      const response = await POST(request)
      const elapsed = Date.now() - start
      
      expect(response.status).toBe(200)
      
      // Should complete within 2 seconds (generous for test environment)
      expect(elapsed).toBeLessThan(2000)
      
      const data = await response.json()
      // Verify retrievalTime is recorded
      expect(data.retrieval.retrievalTime).toBeGreaterThan(0)
    })
  })
})

/**
 * 注意事项：
 * 
 * 1. 当前集成测试限制：
 *    - 未包含真实的embedding向量插入（需要执行实际的向量化）
 *    - 未测试Redis缓存（需要Redis测试环境）
 *    - 未测试实际的pgvector相似度搜索（需要真实向量）
 * 
 * 2. 完整测试环境需要：
 *    - PostgreSQL with pgvector extension
 *    - Redis (可选，用于缓存测试)
 *    - LLM API key (或mock)
 * 
 * 3. 性能测试：
 *    - 详细的P95延迟测试在 tests/performance/rag-retrieval.benchmark.ts
 *    - 这里只做基础的性能验证
 * 
 * 4. 后续改进：
 *    - 添加真实向量数据的测试fixtures
 *    - 添加Redis缓存测试（需要test Redis实例）
 *    - 添加并发测试
 */

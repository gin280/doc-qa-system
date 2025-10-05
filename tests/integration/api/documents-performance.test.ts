/**
 * Integration Tests: Performance Requirements (AC9)
 * 
 * P0 Tests: 6 performance tests
 * 
 * Purpose: Verify that the document management system meets performance SLAs:
 * - Initial page load < 1s (20 documents)
 * - Search response time < 300ms
 * - Delete operation < 2s
 * - Preview opens in < 1s
 * - Conditional polling works
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals'
import { db } from '@/lib/db'
import { documents, documentChunks, users } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Session } from 'next-auth'
import { NextRequest } from 'next/server'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { StorageService } from '@/services/documents/storageService'

// Import API route handlers
import { GET } from '@/app/api/documents/route'
import { DELETE } from '@/app/api/documents/[id]/route'
import { GET as GET_PREVIEW } from '@/app/api/documents/[id]/preview/route'

// Create mock repository
const mockVectorRepo = {
  deleteBatch: jest.fn()
}

/**
 * Seed documents for performance testing
 */
async function seedDocuments(userId: string, count: number) {
  const docs = []
  for (let i = 0; i < count; i++) {
    const docId = nanoid()
    await db.insert(documents).values({
      id: docId,
      userId,
      filename: `test-document-${i}.pdf`,
      fileSize: 1024 * 1024 * (i % 10 + 1), // 1-10 MB
      fileType: 'application/pdf',
      storagePath: `documents/${userId}/${docId}.pdf`,
      status: i < 5 ? 'READY' : (i < 10 ? 'PARSING' : 'READY'), // Mix of statuses
      chunksCount: i < 5 ? 10 : 0,
      contentLength: 5000,
      uploadedAt: new Date(Date.now() - i * 60000) // Spread over time
    })
    docs.push({ id: docId, filename: `test-document-${i}.pdf` })
  }
  return docs
}

/**
 * Mock authenticated request helpers
 */
function createAuthenticatedRequest(url: string, userId: string, options?: any): NextRequest {
  const mockSession: Session = {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Performance Tests (AC9)', () => {
  let testUserId: string
  let vectorCreateSpy: jest.SpyInstance
  let storageDeleteSpy: jest.SpyInstance

  // Performance tests need longer timeout due to large data seeding (up to 100 documents)
  jest.setTimeout(30000)

  beforeAll(() => {
    // Spy on VectorRepositoryFactory.create
    vectorCreateSpy = jest.spyOn(VectorRepositoryFactory, 'create').mockReturnValue(mockVectorRepo as any)
    
    // Spy on StorageService.deleteFile
    storageDeleteSpy = jest.spyOn(StorageService, 'deleteFile')
  })

  afterAll(() => {
    vectorCreateSpy.mockRestore()
    storageDeleteSpy.mockRestore()
  })

  beforeEach(async () => {
    testUserId = nanoid()
    
    // Clean up existing test user first
    await db.delete(users).where(eq(users.email, 'test@test.com'))
    
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'test@test.com',
      name: 'Test User'
    })

    // Reset mocks
    mockVectorRepo.deleteBatch.mockClear()
    mockVectorRepo.deleteBatch.mockResolvedValue(true)
    
    storageDeleteSpy.mockClear()
    storageDeleteSpy.mockResolvedValue(true)
  })

  afterEach(async () => {
    // Cleanup
    await db.delete(documentChunks)
    await db.delete(documents)
    await db.delete(users).where(eq(users.id, testUserId))
    jest.restoreAllMocks()
  })

  // ============================================================================
  // P0-PERF-001: Initial page load performance
  // ============================================================================
  it('P0-PERF-001: Should return 20 documents in < 1s', async () => {
    // Setup: Seed 20 documents
    await seedDocuments(testUserId, 20)

    // Act: Measure load time
    const startTime = Date.now()
    const request = createAuthenticatedRequest('/api/documents', testUserId)
    const response = await GET(request)
    const elapsedTime = Date.now() - startTime

    // Assert: Success and performance
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.documents).toHaveLength(20)
    expect(elapsedTime).toBeLessThan(1000) // < 1s
  })

  // ============================================================================
  // P0-PERF-002: Search query performance
  // ============================================================================
  it('P0-PERF-002: Should complete search query in < 300ms', async () => {
    // Setup: Seed documents with varied names
    await seedDocuments(testUserId, 50)

    // Act: Search with query
    const startTime = Date.now()
    const request = createAuthenticatedRequest(
      '/api/documents?search=test-document-1',
      testUserId
    )
    const response = await GET(request)
    const elapsedTime = Date.now() - startTime

    // Assert: Success and performance
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.documents.length).toBeGreaterThan(0)
    expect(elapsedTime).toBeLessThan(300) // < 300ms
  })

  // ============================================================================
  // P0-PERF-003: Delete operation performance
  // ============================================================================
  it('P0-PERF-003: Should delete document with 50 chunks in < 2s', async () => {
    // Setup: Create document with 50 chunks
    const docId = nanoid()
    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: 'large-doc.pdf',
      fileSize: 10 * 1024 * 1024,
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${docId}.pdf`,
      status: 'READY',
      chunksCount: 50,
      contentLength: 50000,
      uploadedAt: new Date()
    })

    // Create 50 chunks
    for (let i = 0; i < 50; i++) {
      const chunkId = nanoid()
      await db.insert(documentChunks).values({
        id: chunkId,
        documentId: docId,
        chunkIndex: i,
        content: `Chunk ${i}`,
        embeddingId: `embedding_${chunkId}`
      })
    }

    // Act: Delete and measure time
    const startTime = Date.now()
    const request = createAuthenticatedRequest(
      `/api/documents/${docId}`,
      testUserId,
      { method: 'DELETE' }
    )
    const response = await DELETE(request, { params: { id: docId } })
    const elapsedTime = Date.now() - startTime

    // Assert: Success and performance
    expect(response.status).toBe(200)
    expect(elapsedTime).toBeLessThan(2000) // < 2s
  })

  // ============================================================================
  // P0-PERF-004: Preview load performance
  // ============================================================================
  it('P0-PERF-004: Should load preview in < 1s', async () => {
    // Setup: Create document
    const docId = nanoid()
    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: 'preview-test.pdf',
      fileSize: 1024 * 1024,
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${docId}.pdf`,
      status: 'READY',
      chunksCount: 10,
      contentLength: 5000,
      uploadedAt: new Date()
    })

    // Create chunks with content for preview
    for (let i = 0; i < 10; i++) {
      const chunkId = nanoid()
      await db.insert(documentChunks).values({
        id: chunkId,
        documentId: docId,
        chunkIndex: i,
        content: `This is chunk ${i} content for preview testing. `.repeat(10),
        embeddingId: `embedding_${chunkId}`
      })
    }

    // Act: Load preview and measure time
    const startTime = Date.now()
    const request = createAuthenticatedRequest(
      `/api/documents/${docId}/preview`,
      testUserId
    )
    const response = await GET_PREVIEW(request, { params: { id: docId } })
    const elapsedTime = Date.now() - startTime

    // Assert: Success and performance
    expect(response.status).toBe(200)
    expect(elapsedTime).toBeLessThan(1000) // < 1s
  })

  // ============================================================================
  // P0-PERF-005: Pagination performance
  // ============================================================================
  it('P0-PERF-005: Should maintain performance with pagination', async () => {
    // Setup: Seed 100 documents
    await seedDocuments(testUserId, 100)

    // Act: Test multiple pages
    const timings = []
    for (let page = 1; page <= 3; page++) {
      const startTime = Date.now()
      const request = createAuthenticatedRequest(
        `/api/documents?page=${page}&limit=20`,
        testUserId
      )
      const response = await GET(request)
      const elapsedTime = Date.now() - startTime
      timings.push(elapsedTime)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.documents).toHaveLength(20)
    }

    // Assert: All pages load in < 1s
    timings.forEach(time => {
      expect(time).toBeLessThan(1000)
    })
  })

  // ============================================================================
  // P0-PERF-006: Sort options performance
  // ============================================================================
  it('P0-PERF-006: Should maintain performance with different sort options', async () => {
    // Setup: Seed 50 documents
    await seedDocuments(testUserId, 50)

    const sortOptions = [
      'uploadedAt:desc',
      'uploadedAt:asc',
      'filename:asc',
      'filename:desc',
      'fileSize:desc'
    ]

    // Act: Test each sort option
    for (const sort of sortOptions) {
      const [sortBy, sortOrder] = sort.split(':')
      const startTime = Date.now()
      const request = createAuthenticatedRequest(
        `/api/documents?sortBy=${sortBy}&sortOrder=${sortOrder}`,
        testUserId
      )
      const response = await GET(request)
      const elapsedTime = Date.now() - startTime

      // Assert: Success and performance
      expect(response.status).toBe(200)
      expect(elapsedTime).toBeLessThan(500) // < 500ms for sorts
    }
  })
})
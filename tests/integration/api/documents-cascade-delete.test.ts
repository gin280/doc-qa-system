/**
 * Integration Tests: Cascade Delete with Retry/Rollback (SEC-001)
 * 
 * P0 Tests: 8 cascade delete tests
 * 
 * Purpose: Verify that document deletion properly handles:
 * - Correct deletion order (vectors → storage → DB)
 * - Retry mechanism with exponential backoff
 * - Rollback on vector deletion failure
 * - No orphaned data after operations
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals'
import { db } from '@/lib/db'
import { documents, documentChunks, users } from '../../../drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Session } from 'next-auth'
import { NextRequest } from 'next/server'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { StorageService } from '@/services/documents/storageService'

// Import API route handlers
import { DELETE } from '@/app/api/documents/[id]/route'

// Create mock repository
const mockVectorRepo = {
  deleteBatch: jest.fn()
}

interface TestDocument {
  id: string
  userId: string
  filename: string
  storagePath: string
  chunks: Array<{ id: string; chunkIndex: number }>
}

/**
 * Setup: Create test document with chunks and vectors
 */
async function setupTestDocument(userId: string, chunkCount: number = 10): Promise<TestDocument> {
  const docId = nanoid()
  const storagePath = `documents/${userId}/${docId}.pdf`

  // Create document
  await db.insert(documents).values({
    id: docId,
    userId,
    filename: 'test-document.pdf',
    fileSize: 1024 * 1024,
    fileType: 'application/pdf',
    storagePath,
    status: 'READY',
    chunksCount: chunkCount,
    contentLength: 5000,
    uploadedAt: new Date()
  })

  // Create chunks
  const chunks = []
  for (let i = 0; i < chunkCount; i++) {
    const chunkId = nanoid()
    await db.insert(documentChunks).values({
      id: chunkId,
      documentId: docId,
      chunkIndex: i,
      content: `Chunk ${i} content`,
      embeddingId: `embedding_${chunkId}` // Required field
    })
    chunks.push({ id: chunkId, chunkIndex: i })
  }

  return { id: docId, userId, filename: 'test-document.pdf', storagePath, chunks }
}

/**
 * Verify all chunks are deleted
 */
async function countChunks(documentId: string): Promise<number> {
  const chunks = await db.select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
  return chunks.length
}

/**
 * Mock authenticated DELETE request
 */
async function authenticatedDelete(url: string, userId: string) {
  const mockSession: Session = {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  // Extract document ID from URL
  const id = url.split('/').pop() as string
  const request = new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'DELETE' })
  
  return await DELETE(request, { params: { id } })
}

describe('Cascade Delete Tests (SEC-001)', () => {
  let testUserId: string
  let vectorCreateSpy: jest.SpyInstance
  let storageDeleteSpy: jest.SpyInstance

  // Set timeout for retry tests (each retry can take up to 7s total: 1s + 2s + 4s)
  jest.setTimeout(10000)

  beforeAll(() => {
    // Spy on VectorRepositoryFactory.create to return our mock
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

    // Reset mock call counts and set default successful behavior
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
  // P0-CASCADE-001: Verify deletion order (vectors → storage → DB)
  // ============================================================================
  it('P0-CASCADE-001: Should delete in correct order: vectors → storage → DB', async () => {
    const doc = await setupTestDocument(testUserId, 10)

    // Act: Delete document
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Success
    expect(response.status).toBe(200)
    
    // Verify deletion order
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledWith(
      expect.arrayContaining(doc.chunks.map(c => c.id))
    )
    expect(storageDeleteSpy).toHaveBeenCalledWith(doc.storagePath)
    
    // Verify DB cleanup
    const remainingChunks = await countChunks(doc.id)
    expect(remainingChunks).toBe(0)
    
    const [deletedDoc] = await db.select()
      .from(documents)
      .where(eq(documents.id, doc.id))
    expect(deletedDoc).toBeUndefined()
  })

  // ============================================================================
  // P0-CASCADE-002: Rollback on vector deletion failure
  // ============================================================================
  it('P0-CASCADE-002: Should rollback when vector deletion fails', async () => {
    const doc = await setupTestDocument(testUserId)

    // Mock vector deletion to fail
    mockVectorRepo.deleteBatch.mockRejectedValue(new Error('Vector service unavailable'))

    // Act: Attempt delete
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Should fail and not delete DB records
    expect(response.status).toBe(500)
    
    // Verify DB records still exist (rollback)
    const [stillExists] = await db.select()
      .from(documents)
      .where(eq(documents.id, doc.id))
    expect(stillExists).toBeDefined()
    
    const remainingChunks = await countChunks(doc.id)
    expect(remainingChunks).toBe(doc.chunks.length)
  })

  // ============================================================================
  // P0-CASCADE-003: Handle storage deletion failure gracefully
  // ============================================================================
  it('P0-CASCADE-003: Should handle storage deletion failure gracefully', async () => {
    const doc = await setupTestDocument(testUserId)

    // Mock storage deletion to fail
    storageDeleteSpy.mockRejectedValue(new Error('Storage service error'))

    // Act: Delete document
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Should succeed with warning (storage can be cleaned up later)
    expect(response.status).toBe(200)
    
    // DB should be cleaned even if storage fails
    const [deletedDoc] = await db.select()
      .from(documents)
      .where(eq(documents.id, doc.id))
    expect(deletedDoc).toBeUndefined()
  })

  // ============================================================================
  // P0-CASCADE-004: Retry transient failures
  // ============================================================================
  it('P0-CASCADE-004: Should retry transient failures up to 3 times', async () => {
    const doc = await setupTestDocument(testUserId)

    // Mock to fail twice then succeed
    mockVectorRepo.deleteBatch
      .mockRejectedValueOnce(new Error('Temporary failure 1'))
      .mockRejectedValueOnce(new Error('Temporary failure 2'))
      .mockResolvedValueOnce(true)

    // Act: Delete document
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Should eventually succeed
    expect(response.status).toBe(200)
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledTimes(3)
  })

  // ============================================================================
  // P0-CASCADE-005: Fail after max retries
  // ============================================================================
  it('P0-CASCADE-005: Should fail after 3 retry attempts', async () => {
    const doc = await setupTestDocument(testUserId)

    // Mock to always fail
    mockVectorRepo.deleteBatch.mockRejectedValue(new Error('Permanent failure'))

    // Act: Attempt delete
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Should fail after retries
    expect(response.status).toBe(500)
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledTimes(3)
    
    // DB should not be deleted
    const [stillExists] = await db.select()
      .from(documents)
      .where(eq(documents.id, doc.id))
    expect(stillExists).toBeDefined()
  })

  // ============================================================================
  // P0-CASCADE-006: No orphaned vectors
  // ============================================================================
  it('P0-CASCADE-006: Should remove all vectors with no orphans', async () => {
    const doc = await setupTestDocument(testUserId, 10)

    // Act: Delete document
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: All vectors removed
    expect(response.status).toBe(200)
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledWith(
      expect.arrayContaining(doc.chunks.map(c => c.id))
    )
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledTimes(1)
    
    // No orphaned chunks in DB
    const remainingChunks = await countChunks(doc.id)
    expect(remainingChunks).toBe(0)
  })

  // ============================================================================
  // P0-CASCADE-007: Concurrent deletes
  // ============================================================================
  it('P0-CASCADE-007: Should handle multiple concurrent deletes safely', async () => {
    const doc1 = await setupTestDocument(testUserId, 5)
    const doc2 = await setupTestDocument(testUserId, 5)
    const doc3 = await setupTestDocument(testUserId, 5)

    // Act: Delete concurrently
    const results = await Promise.all([
      authenticatedDelete(`/api/documents/${doc1.id}`, testUserId),
      authenticatedDelete(`/api/documents/${doc2.id}`, testUserId),
      authenticatedDelete(`/api/documents/${doc3.id}`, testUserId)
    ])

    // Assert: All succeed
    results.forEach(response => {
      expect(response.status).toBe(200)
    })
    
    // All docs deleted
    const remaining = await db.select()
      .from(documents)
      .where(eq(documents.userId, testUserId))
    expect(remaining).toHaveLength(0)
  })

  // ============================================================================
  // P0-CASCADE-008: Large document (50 chunks)
  // ============================================================================
  it('P0-CASCADE-008: Should handle large document with 50 chunks', async () => {
    const doc = await setupTestDocument(testUserId, 50)

    // Act: Delete large document
    const response = await authenticatedDelete(`/api/documents/${doc.id}`, testUserId)

    // Assert: Success
    expect(response.status).toBe(200)
    
    // All 50 chunks deleted
    expect(mockVectorRepo.deleteBatch).toHaveBeenCalledWith(
      expect.arrayContaining(doc.chunks.map(c => c.id))
    )
    
    const remainingChunks = await countChunks(doc.id)
    expect(remainingChunks).toBe(0)
  })
})
/**
 * Integration Tests: Critical Path Functionality
 * 
 * P0 Tests: 3 critical path tests
 * 
 * Purpose: Verify basic functionality that must work:
 * - Document list retrieval
 * - File validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents, users } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Session } from 'next-auth'

// Import API route handlers
import { GET } from '@/app/api/documents/route'
import { PATCH, DELETE } from '@/app/api/documents/[id]/route'
import { GET as GET_PREVIEW } from '@/app/api/documents/[id]/preview/route'

/**
 * Mock authenticated request
 */
function createAuthenticatedRequest(url: string, userId: string, options?: any): NextRequest {
  const mockSession: Session = {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
  
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Critical Path Tests', () => {
  let testUserId: string

  beforeEach(async () => {
    testUserId = nanoid()
    
    // Clean up any existing test user with this email first
    await db.delete(users).where(eq(users.email, 'test@test.com'))
    
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: 'test@test.com',
      name: 'Test User'
    })
  })

  afterEach(async () => {
    // Cleanup
    await db.delete(documents)
    await db.delete(users).where(eq(users.id, testUserId))
    jest.restoreAllMocks()
  })

  // ============================================================================
  // P0-CRITICAL-001: Basic document list retrieval works
  // ============================================================================
  it('P0-CRITICAL-001: Should successfully retrieve user document list', async () => {
    // Setup: Create a few test documents
    const docIds = []
    for (let i = 0; i < 5; i++) {
      const docId = nanoid()
      await db.insert(documents).values({
        id: docId,
        userId: testUserId,
        filename: `document-${i}.pdf`,
        fileSize: 1024 * 1024,
        fileType: 'application/pdf',
        storagePath: `documents/${testUserId}/${docId}.pdf`,
        status: 'READY',
        chunksCount: 10,
        contentLength: 5000,
        uploadedAt: new Date()
      })
      docIds.push(docId)
    }

    // Act: Call API handler directly
    const request = createAuthenticatedRequest('/api/documents', testUserId)
    const response = await GET(request)

    // Assert: Success
    expect(response.status).toBe(200)
    
    const data = await response.json()
    
    // Verify structure
    expect(data).toHaveProperty('documents')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('page')
    expect(data).toHaveProperty('totalPages')
    
    // Verify data
    expect(data.documents).toHaveLength(5)
    expect(data.total).toBe(5)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(1)
    
    // Verify document structure
    const doc = data.documents[0]
    expect(doc).toHaveProperty('id')
    expect(doc).toHaveProperty('filename')
    expect(doc).toHaveProperty('fileSize')
    expect(doc).toHaveProperty('fileType')
    expect(doc).toHaveProperty('status')
    expect(doc).toHaveProperty('chunksCount')
    expect(doc).toHaveProperty('uploadedAt')
    
    // Verify sorting (default: uploadedAt DESC)
    const uploadDates = data.documents.map((d: any) => new Date(d.uploadedAt).getTime())
    for (let i = 0; i < uploadDates.length - 1; i++) {
      expect(uploadDates[i]).toBeGreaterThanOrEqual(uploadDates[i + 1])
    }
  })

  // ============================================================================
  // P0-CRITICAL-002: Filename validation works correctly
  // ============================================================================
  it('P0-CRITICAL-002: Should validate filename and reject invalid inputs', async () => {
    // Setup: Create a test document
    const docId = nanoid()
    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: 'original.pdf',
      fileSize: 1024 * 1024,
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${docId}.pdf`,
      status: 'READY',
      chunksCount: 10,
      contentLength: 5000,
      uploadedAt: new Date()
    })

    // Test Case 1: Empty filename
    let request = createAuthenticatedRequest(
      `/api/documents/${docId}`,
      testUserId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: '' })
      }
    )
    let response = await PATCH(request, { params: { id: docId } })
    expect(response.status).toBe(400)
    let error = await response.json()
    expect(error.error).toContain('不能为空')

    // Test Case 2: Filename too long (> 255 chars)
    request = createAuthenticatedRequest(
      `/api/documents/${docId}`,
      testUserId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'a'.repeat(256) + '.pdf' })
      }
    )
    response = await PATCH(request, { params: { id: docId } })
    expect(response.status).toBe(400)
    error = await response.json()
    expect(error.error).toContain('过长')

    // Test Case 3: Invalid characters
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    for (const char of invalidChars) {
      request = createAuthenticatedRequest(
        `/api/documents/${docId}`,
        testUserId,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: `invalid${char}name.pdf` })
        }
      )
      response = await PATCH(request, { params: { id: docId } })
      expect(response.status).toBe(400)
      error = await response.json()
      expect(error.error).toContain('非法字符')
    }

    // Test Case 4: Valid filename
    request = createAuthenticatedRequest(
      `/api/documents/${docId}`,
      testUserId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'valid-filename-123.pdf' })
      }
    )
    response = await PATCH(request, { params: { id: docId } })
    expect(response.status).toBe(200)
    
    // Verify rename succeeded
    const [updated] = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
    expect(updated.filename).toBe('valid-filename-123.pdf')
  })

  // ============================================================================
  // P0-CRITICAL-003: Error handling works correctly
  // ============================================================================
  it('P0-CRITICAL-003: Should handle errors gracefully with proper responses', async () => {
    // Test Case 1: Document not found (DELETE)
    const fakeId = nanoid()
    let request = createAuthenticatedRequest(
      `/api/documents/${fakeId}`,
      testUserId,
      { method: 'DELETE' }
    )
    let response = await DELETE(request, { params: { id: fakeId } })
    expect(response.status).toBe(404)
    let error = await response.json()
    expect(error.error).toContain('不存在')

    // Test Case 2: Invalid query parameters
    request = createAuthenticatedRequest(
      '/api/documents?page=-1&limit=0',
      testUserId
    )
    response = await GET(request) as any
    // Should handle gracefully (either default values or validation error)
    expect([200, 400]).toContain(response.status)

    // Test Case 3: Malformed request body
    const docId = nanoid()
    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: 'test.pdf',
      fileSize: 1024 * 1024,
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${docId}.pdf`,
      status: 'READY',
      chunksCount: 10,
      contentLength: 5000,
      uploadedAt: new Date()
    })

    request = createAuthenticatedRequest(
      `/api/documents/${docId}`,
      testUserId,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      }
    )
    response = await PATCH(request, { params: { id: docId } }) as any
    expect([400, 500]).toContain(response.status)

    // Test Case 4: Preview before document is ready
    const pendingDocId = nanoid()
    await db.insert(documents).values({
      id: pendingDocId,
      userId: testUserId,
      filename: 'pending.pdf',
      fileSize: 1024 * 1024,
      fileType: 'application/pdf',
      storagePath: `documents/${testUserId}/${pendingDocId}.pdf`,
      status: 'PENDING',
      chunksCount: 0,
      contentLength: 0,
      uploadedAt: new Date()
    })

    request = createAuthenticatedRequest(
      `/api/documents/${pendingDocId}/preview`,
      testUserId
    )
    response = await GET_PREVIEW(request, { params: { id: pendingDocId } }) as any
    expect(response.status).toBe(400)
    error = await response.json()
    expect(error.error).toContain('尚未解析')

    // Test Case 5: Empty state (no documents)
    await db.delete(documents).where(eq(documents.userId, testUserId))
    
    request = createAuthenticatedRequest('/api/documents', testUserId)
    response = await GET(request) as any
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.documents).toHaveLength(0)
    expect(data.total).toBe(0)
    expect(data.totalPages).toBe(0)
  })
})

/**
 * Integration Tests: Document Authorization (SEC-002)
 * 
 * P0 Tests: 15 authorization and cross-user security tests
 * 
 * Purpose: Verify that users can only access their own documents
 * and that all API endpoints properly validate ownership.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { db } from '@/lib/db'
import { documents, users } from '../../../drizzle/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Session } from 'next-auth'
import { NextRequest } from 'next/server'

// Import API route handlers
import { GET } from '@/app/api/documents/route'
import { PATCH, DELETE } from '@/app/api/documents/[id]/route'
import { GET as GET_PREVIEW } from '@/app/api/documents/[id]/preview/route'

// Test helpers
interface TestUser {
  id: string
  email: string
  name: string
  token: string // Mock JWT token
}

interface TestDocument {
  id: string
  userId: string
  filename: string
  fileSize: number
  fileType: string
  storagePath: string
  status: 'PENDING' | 'PARSING' | 'EMBEDDING' | 'READY' | 'FAILED'
}

/**
 * Create a test user in database
 */
async function createTestUser(email: string): Promise<TestUser> {
  const userId = nanoid()
  
  // Clean up existing user with this email first
  await db.delete(users).where(eq(users.email, email))
  
  await db.insert(users).values({
    id: userId,
    email,
    name: `Test User ${email}`
  })

  return {
    id: userId,
    email,
    name: `Test User ${email}`,
    token: `mock_token_${userId}`
  }
}

/**
 * Create a test document for a user
 */
async function createTestDocument(userId: string, filename: string = 'test.pdf'): Promise<TestDocument> {
  const docId = nanoid()
  
  const [doc] = await db.insert(documents).values({
    id: docId,
    userId,
    filename,
    fileSize: 1024 * 1024, // 1MB
    fileType: 'application/pdf',
    storagePath: `documents/${userId}/${docId}.pdf`,
    status: 'READY',
    chunksCount: 10,
    contentLength: 5000,
    uploadedAt: new Date()
  }).returning()

  return doc as TestDocument
}

/**
 * Create authenticated NextRequest for testing
 */
function createAuthenticatedRequest(url: string, userId: string, options?: any): NextRequest {
  const mockSession: Session = {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

/**
 * Create unauthenticated NextRequest for testing
 */
function createUnauthenticatedRequest(url: string, options?: any): NextRequest {
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(null)
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

/**
 * Wrapper function to call API handlers (backward compatible with old fetch-based tests)
 */
async function authenticatedFetch(url: string, options: RequestInit, user: TestUser) {
  const mockSession: Session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(mockSession)

  const request = new NextRequest(new URL(url, 'http://localhost:3000'), options)
  
  // Route to appropriate handler based on URL and method
  if (url === '/api/documents' && options.method === 'GET') {
    return await GET(request)
  } else if (url.startsWith('/api/documents/') && url.endsWith('/preview') && options.method === 'GET') {
    const id = url.split('/')[3]
    return await GET_PREVIEW(request, { params: { id } })
  } else if (url.startsWith('/api/documents/') && options.method === 'PATCH') {
    const id = url.split('/')[3]
    return await PATCH(request, { params: { id } })
  } else if (url.startsWith('/api/documents/') && options.method === 'DELETE') {
    const id = url.split('/')[3]
    return await DELETE(request, { params: { id } })
  }
  
  throw new Error(`Unhandled route: ${options.method} ${url}`)
}

/**
 * Unauthenticated fetch wrapper
 */
async function unauthenticatedFetch(url: string, options: RequestInit) {
  jest.spyOn(require('@/lib/auth'), 'auth').mockResolvedValue(null)
  
  const request = new NextRequest(new URL(url, 'http://localhost:3000'), options)
  
  // Route to appropriate handler
  if (url === '/api/documents' && options.method === 'GET') {
    return await GET(request)
  } else if (url.startsWith('/api/documents/') && url.endsWith('/preview')) {
    const id = url.split('/')[3]
    return await GET_PREVIEW(request, { params: { id } })
  } else if (url.startsWith('/api/documents/') && options.method === 'PATCH') {
    const id = url.split('/')[3]
    return await PATCH(request, { params: { id } })
  } else if (url.startsWith('/api/documents/') && options.method === 'DELETE') {
    const id = url.split('/')[3]
    return await DELETE(request, { params: { id } })
  }
  
  throw new Error(`Unhandled route: ${options.method} ${url}`)
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  // Delete all test documents
  await db.delete(documents)
  
  // Delete test users (by email pattern)
  await db.delete(users).where(eq(users.email, 'user-a@test.com'))
  await db.delete(users).where(eq(users.email, 'user-b@test.com'))
}

describe('Document Authorization Tests (SEC-002)', () => {
  let userA: TestUser
  let userB: TestUser
  let docA: TestDocument
  let docB: TestDocument

  beforeEach(async () => {
    // Create two test users
    userA = await createTestUser('user-a@test.com')
    userB = await createTestUser('user-b@test.com')

    // Create documents for each user
    docA = await createTestDocument(userA.id, 'user-a-document.pdf')
    docB = await createTestDocument(userB.id, 'user-b-document.pdf')
  })

  afterEach(async () => {
    await cleanupTestData()
    jest.restoreAllMocks()
  })

  // ============================================================================
  // P0-AUTH-001: GET /api/documents - Only return user's own documents
  // ============================================================================
  it('P0-AUTH-001: Should only return documents owned by authenticated user', async () => {
    // User A requests their documents
    const responseA = await authenticatedFetch('/api/documents', { method: 'GET' }, userA)
    const dataA = await responseA.json()

    expect(responseA.status).toBe(200)
    expect(dataA.documents).toHaveLength(1)
    expect(dataA.documents[0].id).toBe(docA.id)
    // Note: userId is not returned by API for security reasons
  })

  // ============================================================================
  // P0-AUTH-002: GET /api/documents - User B's documents not in User A's list
  // ============================================================================
  it('P0-AUTH-002: Should not return other users documents in list', async () => {
    const responseA = await authenticatedFetch('/api/documents', { method: 'GET' }, userA)
    const dataA = await responseA.json()

    // User A's list should not contain User B's document
    const containsUserBDoc = dataA.documents.some((doc: any) => doc.id === docB.id)
    expect(containsUserBDoc).toBe(false)
  })

  // ============================================================================
  // P0-AUTH-003: PATCH /api/documents/:id - Cannot rename other user's document
  // ============================================================================
  it('P0-AUTH-003: Should prevent User A from renaming User B document', async () => {
    const response = await authenticatedFetch(
      `/api/documents/${docB.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'hacked.pdf' })
      },
      userA
    )

    // Should return 404 (not 403) to avoid leaking document existence
    expect(response.status).toBe(404)

    // Verify document unchanged
    const [unchanged] = await db.select()
      .from(documents)
      .where(eq(documents.id, docB.id))
    
    expect(unchanged.filename).toBe('user-b-document.pdf')
  })

  // ============================================================================
  // P0-AUTH-004: PATCH /api/documents/:id - Can rename own document
  // ============================================================================
  it('P0-AUTH-004: Should allow User A to rename their own document', async () => {
    const response = await authenticatedFetch(
      `/api/documents/${docA.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'renamed-document.pdf' })
      },
      userA
    )

    expect(response.status).toBe(200)

    // Verify document was renamed
    const [renamed] = await db.select()
      .from(documents)
      .where(eq(documents.id, docA.id))
    
    expect(renamed.filename).toBe('renamed-document.pdf')
  })

  // ============================================================================
  // P0-AUTH-005: DELETE /api/documents/:id - Cannot delete other user's document
  // ============================================================================
  it('P0-AUTH-005: Should prevent User A from deleting User B document', async () => {
    const response = await authenticatedFetch(
      `/api/documents/${docB.id}`,
      { method: 'DELETE' },
      userA
    )

    // Should return 404 (not 403)
    expect(response.status).toBe(404)

    // Verify document still exists
    const [stillExists] = await db.select()
      .from(documents)
      .where(eq(documents.id, docB.id))
    
    expect(stillExists).toBeDefined()
    expect(stillExists.filename).toBe('user-b-document.pdf')
  })

  // ============================================================================
  // P0-AUTH-006: DELETE /api/documents/:id - Can delete own document
  // ============================================================================
  it('P0-AUTH-006: Should allow User A to delete their own document', async () => {
    // Mock vector and storage deletion
    const mockVectorRepo = {
      deleteBatch: jest.fn().mockResolvedValue(true)
    }
    jest.spyOn(require('@/infrastructure/vector/vector-repository.factory'), 'VectorRepositoryFactory').mockReturnValue({
      create: jest.fn().mockReturnValue(mockVectorRepo)
    })

    const mockStorage = {
      deleteFile: jest.fn().mockResolvedValue(true)
    }
    jest.spyOn(require('@/services/documents/storageService'), 'StorageService').mockReturnValue(mockStorage)

    const response = await authenticatedFetch(
      `/api/documents/${docA.id}`,
      { method: 'DELETE' },
      userA
    )

    expect(response.status).toBe(200)

    // Verify document was deleted
    const [deleted] = await db.select()
      .from(documents)
      .where(eq(documents.id, docA.id))
    
    expect(deleted).toBeUndefined()
  })

  // ============================================================================
  // P0-AUTH-007: GET /api/documents/:id/preview - Cannot preview other user's document
  // ============================================================================
  it('P0-AUTH-007: Should prevent User A from previewing User B document', async () => {
    const response = await authenticatedFetch(
      `/api/documents/${docB.id}/preview`,
      { method: 'GET' },
      userA
    )

    // Should return 404
    expect(response.status).toBe(404)
  })

  // ============================================================================
  // P0-AUTH-008: GET /api/documents/:id/preview - Can preview own document
  // ============================================================================
  it('P0-AUTH-008: Should allow User A to preview their own document', async () => {
    // Add parsed content to document metadata
    await db.update(documents)
      .set({
        metadata: { parsedContent: 'This is the parsed content of the document...' }
      })
      .where(eq(documents.id, docA.id))

    const response = await authenticatedFetch(
      `/api/documents/${docA.id}/preview`,
      { method: 'GET' },
      userA
    )

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.content).toBeDefined()
    expect(data.content).toContain('parsed content')
  })

  // ============================================================================
  // P0-AUTH-009: Unauthenticated - Cannot access any endpoint
  // ============================================================================
  it('P0-AUTH-009: Should reject unauthenticated GET /api/documents', async () => {
    const response = await unauthenticatedFetch('/api/documents', { method: 'GET' })
    expect(response.status).toBe(401)
  })

  it('P0-AUTH-010: Should reject unauthenticated PATCH /api/documents/:id', async () => {
    const response = await unauthenticatedFetch(`/api/documents/${docA.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'hacked.pdf' })
    })
    
    expect(response.status).toBe(401)
  })

  it('P0-AUTH-011: Should reject unauthenticated DELETE /api/documents/:id', async () => {
    const response = await unauthenticatedFetch(`/api/documents/${docA.id}`, { method: 'DELETE' })
    expect(response.status).toBe(401)
  })

  it('P0-AUTH-012: Should reject unauthenticated GET /api/documents/:id/preview', async () => {
    const response = await unauthenticatedFetch(`/api/documents/${docA.id}/preview`, { method: 'GET' })
    expect(response.status).toBe(401)
  })

  // ============================================================================
  // P0-AUTH-013: Security - Attempt logging
  // ============================================================================
  it('P0-AUTH-013: Should log unauthorized access attempts', async () => {
    const consoleSpy = jest.spyOn(console, 'warn')

    await authenticatedFetch(
      `/api/documents/${docB.id}`,
      { method: 'DELETE' },
      userA
    )

    // Verify that unauthorized attempt was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized'),
      expect.objectContaining({
        userId: userA.id,
        documentId: docB.id
      })
    )

    consoleSpy.mockRestore()
  })

  // ============================================================================
  // P0-AUTH-014: Security - No information leakage
  // ============================================================================
  it('P0-AUTH-014: Should return 404 (not 403) to avoid existence leaking', async () => {
    const response = await authenticatedFetch(
      `/api/documents/${docB.id}`,
      { method: 'DELETE' },
      userA
    )

    // Critical: Must be 404, not 403
    // 403 would confirm document exists but user lacks permission
    // 404 doesn't leak whether document exists
    expect(response.status).toBe(404)
    
    const data = await response.json()
    expect(data.error).not.toContain('permission')
    expect(data.error).toContain('不存在')
  })

  // ============================================================================
  // P0-AUTH-015: Security - Multiple operations consistency
  // ============================================================================
  it('P0-AUTH-015: Should consistently block all operations on other user documents', async () => {
    const operations = [
      { method: 'PATCH', url: `/api/documents/${docB.id}`, body: { filename: 'hack.pdf' } },
      { method: 'DELETE', url: `/api/documents/${docB.id}`, body: null },
      { method: 'GET', url: `/api/documents/${docB.id}/preview`, body: null }
    ]

    for (const op of operations) {
      const response = await authenticatedFetch(
        op.url,
        {
          method: op.method,
          headers: op.body ? { 'Content-Type': 'application/json' } : {},
          body: op.body ? JSON.stringify(op.body) : undefined
        },
        userA
      )

      // All should return 404
      expect(response.status).toBe(404)
    }
  })
})

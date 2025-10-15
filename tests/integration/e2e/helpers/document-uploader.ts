/**
 * E2E 测试文档上传和处理辅助函数
 * 提供文档上传、解析、处理和状态轮询功能
 */

import { db } from '@/lib/db';
import { documents, documentChunks } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import FormData from 'form-data';
import { waitForCondition } from './e2e-setup';

/**
 * 上传并处理文档 (完整流程)
 * @param userId - 用户 ID
 * @param testFilePath - 测试文件路径
 * @returns 文档 ID 和文件名
 */
export async function uploadAndProcessDocument(
  userId: string,
  testFilePath: string
): Promise<{ documentId: string; filename: string }> {
  console.log(`📤 Uploading document: ${testFilePath}`);

  // 1. 上传文档
  const { documentId, filename } = await uploadDocument(userId, testFilePath);
  console.log(`✅ Document uploaded: ${documentId}`);

  // 2. 解析文档
  await parseDocument(documentId);
  console.log(`✅ Document parsed: ${documentId}`);

  // 3. 处理文档 (分块 + 向量化)
  await processDocument(documentId);
  console.log(`✅ Document processing started: ${documentId}`);

  // 4. 等待处理完成
  await waitForDocumentReady(documentId);
  console.log(`✅ Document ready: ${documentId}`);

  return { documentId, filename };
}

/**
 * 上传文档到系统
 */
async function uploadDocument(
  userId: string,
  testFilePath: string
): Promise<{ documentId: string; filename: string }> {
  // 创建表单数据
  const form = new FormData();
  const fileStream = fs.createReadStream(testFilePath);
  const filename = testFilePath.split('/').pop() || 'test-file';

  form.append('file', fileStream, filename);

  // 调用上传 API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/documents/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${createMockAuthToken(userId)}`,
      ...form.getHeaders(),
    },
    body: form as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    documentId: data.documentId,
    filename: data.filename,
  };
}

/**
 * 解析文档内容
 */
async function parseDocument(documentId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/documents/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Parse failed: ${response.status} - ${errorText}`);
  }
}

/**
 * 处理文档 (分块 + 向量化)
 */
async function processDocument(documentId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/documents/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Process failed: ${response.status} - ${errorText}`);
  }
}

/**
 * 等待文档处理完成
 */
async function waitForDocumentReady(
  documentId: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 60000, interval = 2000 } = options;

  await waitForCondition(
    async () => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId));
      return doc;
    },
    (doc) => {
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }
      if (doc.status === 'failed') {
        throw new Error(`Document processing failed: ${documentId}`);
      }
      return doc.status === 'ready';
    },
    {
      timeout,
      interval,
      errorMessage: `Document not ready within timeout: ${documentId}`,
    }
  );
}

/**
 * 验证文档已准备就绪
 * 检查文档状态和 chunks
 */
export async function verifyDocumentReady(documentId: string): Promise<{
  document: any;
  chunks: any[];
}> {
  // 验证文档状态
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  if (doc.status !== 'ready') {
    throw new Error(`Document not ready: ${documentId}, status: ${doc.status}`);
  }

  // 验证 chunks 和 vectors
  const chunks = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId));

  if (chunks.length === 0) {
    throw new Error(`No chunks found for document: ${documentId}`);
  }

  // 验证 embedding
  const firstChunk = chunks[0];
  if (!firstChunk.embedding || firstChunk.embedding.length === 0) {
    throw new Error(`Chunk has no embedding: ${firstChunk.id}`);
  }

  console.log(
    `✅ Document verified: ${documentId}, ${chunks.length} chunks, embedding dimension: ${firstChunk.embedding.length}`
  );

  return { document: doc, chunks };
}

/**
 * 创建 Mock Auth Token (用于测试)
 */
function createMockAuthToken(userId: string): string {
  // 在实际测试中,这里应该返回有效的测试 token
  // 或者 API 路由应该有测试模式来接受特殊的测试 token
  return `test-token-${userId}`;
}

/**
 * 获取文档状态
 */
export async function getDocumentStatus(documentId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/documents/${documentId}/status`);

  if (!response.ok) {
    throw new Error(`Failed to get document status: ${response.status}`);
  }

  const data = await response.json();
  return data.status;
}


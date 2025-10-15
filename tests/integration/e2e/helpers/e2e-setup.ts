/**
 * E2E 测试环境初始化和清理
 * 提供测试用户创建、数据清理等基础设施
 */

import { db } from '@/lib/db';
import { users, documents, documentChunks, conversations, messages } from '@/drizzle/schema';
import { eq, like } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export interface E2ETestContext {
  userId: string;
  userEmail: string;
  userName: string;
  documentId: string | null;
  conversationId: string | null;
  createdDocumentIds: string[];
  cleanup: () => Promise<void>;
}

/**
 * 设置 E2E 测试环境
 * 创建唯一的测试用户和清理函数
 */
export async function setupE2ETest(): Promise<E2ETestContext> {
  const timestamp = Date.now();
  const userId = `e2e-user-${timestamp}`;
  const userEmail = `e2e-${timestamp}@example.com`;
  const userName = `E2E Test User ${timestamp}`;

  // 创建测试用户
  await db.insert(users).values({
    id: userId,
    email: userEmail,
    name: userName,
    emailVerified: new Date(),
    createdAt: new Date(),
  });

  console.log(`✅ Created E2E test user: ${userId}`);

  const context: E2ETestContext = {
    userId,
    userEmail,
    userName,
    documentId: null,
    conversationId: null,
    createdDocumentIds: [],
    cleanup: async () => {
      await cleanupE2ETestData(context);
    },
  };

  return context;
}

/**
 * 清理 E2E 测试数据
 * 删除测试用户及其关联的所有数据
 */
async function cleanupE2ETestData(context: E2ETestContext): Promise<void> {
  try {
    console.log(`🧹 Cleaning up E2E test data for user: ${context.userId}`);

    // 1. 清理 Supabase Storage 文件
    if (context.createdDocumentIds.length > 0) {
      await cleanupStorageFiles(context.createdDocumentIds);
    }

    // 2. 删除测试用户 (级联删除会自动清理相关数据)
    // CASCADE DELETE 会删除:
    // - documents (包括 chunks 和 vectors)
    // - conversations
    // - messages
    const deletedUsers = await db
      .delete(users)
      .where(eq(users.id, context.userId))
      .returning();

    if (deletedUsers.length > 0) {
      console.log(`✅ Deleted test user and all related data: ${context.userId}`);
    } else {
      console.warn(`⚠️  User not found for deletion: ${context.userId}`);
    }
  } catch (error) {
    console.error('❌ Error during E2E test cleanup:', error);
    throw error;
  }
}

/**
 * 清理 Supabase Storage 中的测试文件
 */
async function cleanupStorageFiles(documentIds: string[]): Promise<void> {
  try {
    // 检查 documentIds 是否为空
    if (documentIds.length === 0) {
      console.log('⚠️  No document IDs to clean up');
      return;
    }

    // 获取 Supabase 客户端
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 修正查询逻辑: 应该根据 documentIds 查询,而不是 userId
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentIds[0]));

    if (docs.length > 0) {
      const filePaths = docs
        .map((doc) => doc.filePath)
        .filter((path): path is string => path !== null);

      if (filePaths.length > 0) {
        const { error } = await supabase.storage
          .from('documents')
          .remove(filePaths);

        if (error) {
          console.error('⚠️  Error removing files from Storage:', error);
        } else {
          console.log(`✅ Deleted ${filePaths.length} files from Supabase Storage`);
        }
      }
    }
  } catch (error) {
    console.error('⚠️  Error cleaning up storage files:', error);
    // 不抛出错误,允许继续清理其他数据
  }
}

/**
 * 批量清理所有 E2E 测试数据
 * 用于手动清理脚本
 */
export async function cleanupAllE2ETestData(): Promise<void> {
  console.log('🧹 Starting cleanup of all E2E test data...');

  try {
    // 1. 查找所有 E2E 测试用户
    const testUsers = await db
      .select()
      .from(users)
      .where(like(users.email, 'e2e-%@example.com'));

    console.log(`Found ${testUsers.length} E2E test users to clean up`);

    // 2. 获取所有测试文档用于清理 Storage
    const testDocumentIds = testUsers.map((u) => u.id);
    if (testDocumentIds.length > 0) {
      await cleanupStorageFiles(testDocumentIds);
    }

    // 3. 删除所有测试用户 (级联删除相关数据)
    const deletedUsers = await db
      .delete(users)
      .where(like(users.email, 'e2e-%@example.com'))
      .returning();

    console.log(`✅ Deleted ${deletedUsers.length} E2E test users and all related data`);

    console.log('✨ E2E test cleanup complete!');
  } catch (error) {
    console.error('❌ Error during batch E2E test cleanup:', error);
    throw error;
  }
}

/**
 * 等待条件满足 (通用轮询函数)
 */
export async function waitForCondition<T>(
  checkFn: () => Promise<T>,
  validateFn: (result: T) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 60000,
    interval = 2000,
    errorMessage = 'Condition not met within timeout',
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await checkFn();

    if (validateFn(result)) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`${errorMessage} (timeout after ${timeout}ms)`);
}


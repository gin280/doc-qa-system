/**
 * E2E Test: Complete QA Flow
 * 测试完整的问答流程: 上传 → 解析 → 分块 → 向量化 → 查询 → 回答
 */

import { setupE2ETest, type E2ETestContext } from './helpers/e2e-setup';
import {
  uploadAndProcessDocument,
  verifyDocumentReady,
} from './helpers/document-uploader';
import {
  executeQuery,
  verifyConversationHistory,
} from './helpers/query-executor';
import path from 'path';

describe('E2E: Complete QA Flow', () => {
  let context: E2ETestContext | undefined;

  beforeAll(async () => {
    context = await setupE2ETest();
  });

  afterAll(async () => {
    try {
      if (context?.cleanup) {
        await context.cleanup();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('应该完成从上传到问答的完整流程', async () => {
    if (!context) {
      throw new Error('Test context not initialized');
    }

    // Step 1: 上传并处理文档
    const testFilePath = path.join(
      __dirname,
      '../../fixtures/pdf/normal-adobe.pdf'
    );

    const { documentId, filename } = await uploadAndProcessDocument(
      context.userId,
      testFilePath
    );

    context.documentId = documentId;
    context.createdDocumentIds.push(documentId);

    expect(documentId).toBeDefined();
    expect(filename).toContain('.pdf');

    // Step 2: 验证文档状态和 chunks
    const { document, chunks } = await verifyDocumentReady(documentId);

    expect(document.status).toBe('ready');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].embedding).toBeDefined();
    expect(chunks[0].embedding.length).toBe(1536); // OpenAI embedding dimension

    console.log(`📄 Document processed: ${chunks.length} chunks created`);

    // Step 3: 发起第一次查询 (缓存未命中)
    const startTime1 = Date.now();
    const result1 = await executeQuery(
      context.userId,
      documentId,
      '这个文档的主要内容是什么?'
    );
    const duration1 = Date.now() - startTime1;

    expect(result1.answer).toBeDefined();
    expect(result1.answer.length).toBeGreaterThan(10);
    expect(result1.conversationId).toBeDefined();
    expect(duration1).toBeLessThan(5000); // < 5秒 (宽松限制)

    context.conversationId = result1.conversationId;

    console.log(`💬 First query completed in ${duration1}ms`);
    console.log(`📝 Answer preview: ${result1.answer.substring(0, 100)}...`);

    // Step 4: 发起第二次查询 (可能缓存命中)
    const startTime2 = Date.now();
    const result2 = await executeQuery(
      context.userId,
      documentId,
      '这个文档的主要内容是什么?', // 相同查询
      context.conversationId
    );
    const duration2 = Date.now() - startTime2;

    expect(result2.answer).toBeDefined();
    // 注意: 由于是生成式 AI,即使缓存命中,响应时间也可能较长
    // 这里使用宽松的时间限制
    expect(duration2).toBeLessThan(5000);

    console.log(`💬 Second query completed in ${duration2}ms`);
    console.log(
      `⚡ Cache effect: ${duration2 < duration1 ? 'Faster' : 'Similar'}`
    );

    // Step 5: 验证对话历史已保存
    const { conversation, messages: msgs } = await verifyConversationHistory(
      context.conversationId
    );

    expect(conversation).toBeDefined();
    expect(msgs.length).toBeGreaterThanOrEqual(4); // 2 queries × 2 messages (user + assistant)

    // 验证消息角色
    const userMessages = msgs.filter((m) => m.role === 'user');
    const assistantMessages = msgs.filter((m) => m.role === 'assistant');

    expect(userMessages.length).toBeGreaterThanOrEqual(2);
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2);

    console.log(`✅ Complete QA flow test passed!`);
    console.log(`   - Document processed: ${chunks.length} chunks`);
    console.log(`   - First query: ${duration1}ms`);
    console.log(`   - Second query: ${duration2}ms`);
    console.log(`   - Total messages: ${msgs.length}`);
  }, 180000); // 180秒超时 (3分钟)

  it('应该支持在同一对话中进行多轮问答', async () => {
    if (!context) {
      throw new Error('Test context not initialized');
    }

    // 上传测试文档
    const testFilePath = path.join(
      __dirname,
      '../../fixtures/pdf/normal-adobe.pdf'
    );

    const { documentId } = await uploadAndProcessDocument(
      context.userId,
      testFilePath
    );

    context.documentId = documentId;
    context.createdDocumentIds.push(documentId);

    // 第一轮问答
    const result1 = await executeQuery(
      context.userId,
      documentId,
      '文档的标题是什么?'
    );

    expect(result1.answer).toBeDefined();
    expect(result1.conversationId).toBeDefined();

    const conversationId = result1.conversationId;

    // 第二轮问答 (同一对话)
    const result2 = await executeQuery(
      context.userId,
      documentId,
      '请总结一下主要观点',
      conversationId
    );

    expect(result2.answer).toBeDefined();
    expect(result2.conversationId).toBe(conversationId);

    // 第三轮问答 (同一对话)
    const result3 = await executeQuery(
      context.userId,
      documentId,
      '有什么结论吗?',
      conversationId
    );

    expect(result3.answer).toBeDefined();
    expect(result3.conversationId).toBe(conversationId);

    // 验证对话历史
    const { messages } = await verifyConversationHistory(conversationId);

    // 应该有 6 条消息: 3 个问题 + 3 个回答
    expect(messages.length).toBeGreaterThanOrEqual(6);

    console.log(`✅ Multi-turn conversation test passed!`);
    console.log(`   - Total messages: ${messages.length}`);
  }, 180000);
});


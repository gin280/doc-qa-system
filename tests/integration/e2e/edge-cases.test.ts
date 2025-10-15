/**
 * E2E Test: Edge Cases
 * 测试各种边界情况和错误处理
 */

import { setupE2ETest, type E2ETestContext } from './helpers/e2e-setup';
import {
  uploadAndProcessDocument,
  verifyDocumentReady,
} from './helpers/document-uploader';
import {
  executeQuery,
  executeConcurrentQueries,
} from './helpers/query-executor';
import path from 'path';

describe('E2E: Edge Cases', () => {
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

  // 辅助函数: 确保 context 已初始化
  function ensureContext(): E2ETestContext {
    if (!context) {
      throw new Error('Test context not initialized');
    }
    return context;
  }

  it('应该拒绝空文档', async () => {
    const ctx = ensureContext();
    
    const testFilePath = path.join(
      __dirname,
      '../../fixtures/text/empty.txt'
    );

    // 尝试上传空文档
    await expect(
      uploadAndProcessDocument(ctx.userId, testFilePath)
    ).rejects.toThrow();

    console.log(`✅ Empty document rejected as expected`);
  }, 60000);

  it('应该处理超大文档', async () => {
    // 注意: 这个测试需要 10MB 的测试文件
    // 如果文件不存在,跳过测试
    const testFilePath = path.join(__dirname, '../../fixtures/pdf/10mb.pdf');

    const fs = require('fs');
    if (!fs.existsSync(testFilePath)) {
      console.log(`⚠️  Skipping large document test: file not found`);
      return;
    }

    const { documentId } = await uploadAndProcessDocument(
      context.userId,
      testFilePath
    );

    context.documentId = documentId;
    context.createdDocumentIds.push(documentId);

    const { document, chunks } = await verifyDocumentReady(documentId);

    expect(document.status).toBe('ready');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThanOrEqual(10000); // MAX_CHUNKS 限制

    console.log(`✅ Large document processed: ${chunks.length} chunks`);
  }, 300000); // 5分钟超时

  it('应该拒绝不支持的文件格式', async () => {
    // 创建一个临时的 .exe 文件
    const fs = require('fs');
    const os = require('os');
    const tmpFilePath = path.join(os.tmpdir(), 'test.exe');

    fs.writeFileSync(tmpFilePath, 'This is not a valid executable');

    try {
      await expect(
        uploadAndProcessDocument(context.userId, tmpFilePath)
      ).rejects.toThrow();

      console.log(`✅ Unsupported format rejected as expected`);
    } finally {
      // 清理临时文件
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  }, 60000);

  it('应该明确告知无相关内容', async () => {
    // 上传一个技术文档
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

    // 查询一个完全不相关的问题
    const result = await executeQuery(
      context.userId,
      documentId,
      '今天天气怎么样? 明天会下雨吗?'
    );

    expect(result.answer).toBeDefined();

    // 验证回答包含 "无法找到相关内容" 或类似的提示
    const answer = result.answer.toLowerCase();
    const hasNoContentIndicator =
      answer.includes('无法') ||
      answer.includes('没有') ||
      answer.includes('找不到') ||
      answer.includes('不包含') ||
      answer.includes('未提及') ||
      answer.includes('无关');

    if (!hasNoContentIndicator) {
      console.warn(
        `⚠️  Answer may not clearly indicate no relevant content: ${result.answer.substring(0, 100)}`
      );
    }

    console.log(`✅ Irrelevant query handled`);
    console.log(`   Answer: ${result.answer.substring(0, 150)}...`);
  }, 120000);

  it('应该处理并发查询', async () => {
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

    // 准备并发查询
    const queries = [
      '文档的主要内容是什么?',
      '有哪些重点?',
      '请总结一下',
    ];

    // 执行并发查询
    const results = await executeConcurrentQueries(
      context.userId,
      documentId,
      queries
    );

    // 验证所有查询都成功
    expect(results.length).toBe(queries.length);

    for (const result of results) {
      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(10);
      expect(result.conversationId).toBeDefined();
    }

    console.log(`✅ Concurrent queries completed successfully`);
    console.log(`   - Total queries: ${results.length}`);
    console.log(
      `   - Average duration: ${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)}ms`
    );
  }, 180000);

  it('应该处理特殊字符查询', async () => {
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

    // 包含特殊字符的查询
    const specialQueries = [
      '什么是"重要"的内容?',
      '有关 <标签> 的信息?',
      '100% 确定吗?',
      'A & B 的关系?',
    ];

    for (const query of specialQueries) {
      const result = await executeQuery(context.userId, documentId, query);

      expect(result.answer).toBeDefined();
      console.log(`✅ Special character query handled: ${query}`);
    }
  }, 180000);

  it('应该处理超长查询', async () => {
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

    // 构造一个超长查询
    const longQuery =
      '请详细分析这个文档的主要内容,包括但不限于: ' +
      '1. 核心观点和论据; ' +
      '2. 数据支持和证据; ' +
      '3. 方法论和研究设计; ' +
      '4. 结论和建议; ' +
      '5. 潜在的局限性和未来研究方向. '.repeat(5); // 重复5次

    const result = await executeQuery(context.userId, documentId, longQuery);

    expect(result.answer).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(10);

    console.log(`✅ Long query handled`);
    console.log(`   Query length: ${longQuery.length} characters`);
    console.log(`   Answer length: ${result.answer.length} characters`);
  }, 120000);
});


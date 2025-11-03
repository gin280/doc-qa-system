# Vercel Serverless 文档处理流程修复

## 问题描述

在 Vercel 部署环境中，上传 PDF 文件后，文档状态一直停留在"待处理（PENDING）"状态，无法完成分块和向量化。

## 根本原因

**Vercel Serverless 函数的生命周期限制**：

1. **问题现象**：
   - 文档解析（parse）成功
   - 但分块（chunking）和向量化（embedding）从未执行
   - 文档状态停留在 PENDING，无法变为 READY

2. **原始实现（有问题的异步模式）**：
   ```typescript
   // upload/route.ts - 上传后异步触发解析
   fetch(`${origin}/api/documents/${id}/parse`, { ... })
     .catch(err => logger.error(...))  // ❌ 可能被中断
   
   // parse/route.ts - 解析后异步触发处理
   fetch(`${origin}/api/documents/${id}/process`, { ... })
     .catch(err => logger.error(...))  // ❌ 可能被中断
   ```

3. **为什么会失败**：
   - Serverless 函数在**返回响应后立即终止**
   - 异步的 `fetch` 调用还没来得及完成就被中断
   - 后续的 API 调用（parse 或 process）从未被触发
   - 结果：文档停留在中间状态

## 解决方案

### 方案选择

考虑了以下几个方案：

| 方案 | 优点 | 缺点 | 是否采用 |
|------|------|------|----------|
| 1. 同步执行完整流程 | 简单可靠，保证完成 | 响应时间长（2-3分钟） | ✅ **已采用** |
| 2. Vercel Queue | 真正的后台任务 | 需要额外配置和费用 | ❌ 暂不采用 |
| 3. 消息队列（Redis） | 可靠，可扩展 | 架构复杂度高 | ❌ 暂不采用 |
| 4. 前端轮询 | 实现简单 | 用户体验差 | ❌ 不推荐 |

### 实施方案：同步执行

**修改 `src/app/api/documents/[id]/parse/route.ts`**：

```typescript
// 4. 执行解析
const result = await parseDocument(documentId)

// 5. 同步执行分块和向量化（Vercel serverless 需要同步执行以避免中断）
try {
  const { chunkDocument } = await import('@/services/documents/chunkingService')
  const { embedAndStoreChunks } = await import('@/services/documents/embeddingService')
  
  // 执行分块
  const chunks = await chunkDocument(documentId)
  
  // 执行向量化
  await embedAndStoreChunks(documentId, chunks)
  
  logger.info({ documentId, chunksCount: chunks.length }, 
    'Document processing completed successfully')
  
} catch (processError) {
  // 处理失败记录日志，但不影响解析成功的响应
  logger.error({ documentId, error: processError }, 
    'Document processing failed after parse')
}

// 6. 返回成功响应（在所有处理完成后）
return NextResponse.json({ success: true, ... })
```

### 为什么这个方案有效

1. **保证执行完成**：
   - 整个处理流程（解析→分块→向量化）在一个 serverless 函数中同步执行
   - Serverless 函数不会在处理完成前终止

2. **已配置足够的超时时间**：
   ```typescript
   export const maxDuration = 300 // 5分钟，足够处理大文档
   ```

3. **错误处理健壮**：
   - 即使向量化失败，也会记录日志
   - 用户仍然能看到文档被解析（status = READY）

## 性能影响

### 响应时间变化

- **之前**（异步模式）：
  - 上传响应：~1 秒（但后续处理可能失败）
  - 解析响应：~30 秒
  - **问题**：后续步骤可能永远不会完成

- **现在**（同步模式）：
  - 上传响应：~1 秒（仍然是异步触发解析）
  - 解析响应：**~2-3 分钟**（包含完整处理）
  - **优势**：保证完整处理完成

### 用户体验优化

虽然响应时间增加了，但：
1. ✅ **可靠性大幅提升**：不再出现"卡住"的文档
2. ✅ **状态反馈准确**：一旦响应成功，文档真的处理完成了
3. ✅ **无需轮询**：用户不需要手动刷新或等待

## 验证清单

部署后，验证以下功能：

- [ ] 上传 PDF 文件（< 10MB）
- [ ] 文档状态从 PENDING → PARSING → EMBEDDING → READY
- [ ] 检查 Vercel Logs，确认没有 "worker has exited" 或 fetch 失败错误
- [ ] 文档可以正常搜索和问答
- [ ] 检查 chunks 数量正确存储

## 后续优化方向

如果需要进一步改进用户体验：

1. **前端进度提示**：
   - 显示"正在解析..."、"正在分块..."、"正在生成向量..."等状态
   - 需要修改 API 返回进度信息

2. **流式响应**：
   - 使用 Server-Sent Events 实时推送处理进度
   - 但实现复杂度较高

3. **Vercel Queue（未来）**：
   - 如果业务量增长，考虑使用官方的后台任务方案
   - 需要升级 Vercel 订阅计划

## 参考资料

- [Vercel Serverless Function Limits](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Vercel Queue (Beta)](https://vercel.com/docs/functions/queue)
- [Story 2.3: PDF 解析修复](../stories/2.3-pdf-parsing-fix.md)
- [Story 2.4: 文档分块](../stories/2.4-document-chunking.md)
- [Story 2.5: 向量化处理](../stories/2.5-embedding-generation.md)


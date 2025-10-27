# 简历等文档"指代词查询"问题解决方案

**问题编号**: RAG-Issue-001  
**优先级**: 🔥 P0 - 严重用户体验问题  
**预计工作量**: 方案1 (0.5天) | 方案2 (2天) | 方案3 (3-4天)  
**创建日期**: 2025-01-15  
**作者**: Winston (Architect)

---

## 📋 问题描述

### 用户场景

```
用户上传：张三的简历.pdf
用户提问："这个人的工作经验是什么？"
系统回复：❌ "根据提供的文档无法回答该问题"

预期回复：✅ "张三在2020-2023年担任阿里巴巴高级工程师..."
```

### 影响范围

- **简历文档**: "这个人"、"候选人"、"他/她"等指代词
- **公司文档**: "该公司"、"这家企业"等指代词
- **合同文档**: "甲方"、"乙方"等指代词
- **产品文档**: "这个产品"、"该功能"等指代词

**严重性**: 这是一个**严重的可用性问题**，会让用户觉得系统"很笨"。

---

## 🔍 根因分析

### 技术原因

#### 1. 向量相似度天然低

```
查询: "这个人的工作经验是什么？"
向量: [0.12, -0.34, 0.56, ...]  (泛化、抽象)

文档: "张三，2020-2023年在阿里巴巴担任高级工程师，负责..."
向量: [0.78, 0.45, -0.23, ...]  (具体、实体)

余弦相似度: 0.25 < 0.3 (阈值) ❌ 被过滤掉
```

**关键点**: 泛化指代词与具体实体名称的向量天然距离远！

#### 2. Prompt过于保守

```typescript:src/services/rag/promptBuilder.ts
const systemPrompt = `...
2. 如果答案不在文档中，请明确说明"根据提供的文档无法回答该问题"
...`
```

当检索结果不理想时，LLM会非常保守地拒绝回答。

#### 3. 对话上下文未用于查询改写

```typescript:src/services/rag/answerService.ts
// 虽然会加载对话历史
if (options.includeHistory && conversationId) {
  const history = await conversationService.getConversationHistory(conversationId, 10)
  // ✅ 但只是添加到messages，LLM生成时才看到
  // ❌ 没有用来改写查询，向量检索时已经失败了
}
```

**核心矛盾**: 检索阶段看不到对话历史，只能用原始查询向量检索。

---

## 💡 解决方案（三个层次）

### 方案1️⃣：快速修复 (0.5天开发)

**策略**: 调整Prompt + 降低阈值 + 增加智能提示

#### 1.1 修改 `src/services/rag/promptBuilder.ts`

```typescript
/**
 * 构建System Prompt
 * @param chunks 检索到的文档片段
 * @param documentMetadata 文档元信息（新增参数）
 */
export function buildSystemPrompt(
  chunks: RetrievalChunk[],
  documentMetadata?: { filename?: string; type?: string }
): string {
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n')

  // 🆕 添加文档类型智能提示
  let documentTypeHint = ''
  if (documentMetadata?.type === 'resume' || 
      documentMetadata?.filename?.match(/简历|resume|cv/i)) {
    documentTypeHint = `
## 📄 文档类型：简历文档
**指代消解规则**：
- "这个人"、"候选人"、"他/她" → 指简历的主人
- 从文档中提取人名并在回答时使用
`
  } else if (documentMetadata?.filename?.match(/合同|contract|agreement/i)) {
    documentTypeHint = `
## 📄 文档类型：合同文档
**指代消解规则**：
- "甲方"/"乙方" → 参考合同抬头的具体公司名称
`
  }

  // 🔧 优化后的Prompt（更智能、不过度保守）
  const systemPrompt = `你是一个专业的文档问答助手。请基于以下文档内容回答用户的问题。
${documentTypeHint}

## 📌 重要指令：

1. **智能理解上下文**：充分利用文档信息进行合理推断，不要过度严格
2. **指代消解能力**：理解"这个人"、"该公司"等指代词在文档中的具体所指
3. **宽容但准确**：
   - 如果文档中有相关信息，即使不是完全匹配也应尽力回答
   - 可以合理组合文档中的多个信息点来回答
   - 只有在文档**完全没有**相关信息时，才说"无法回答"
4. **引用标注**：使用[1][2]标注信息来源
5. **完整作答**：尽量给出完整、有用的答案，而不是简单拒绝

## 📚 文档内容：
${context}

请基于以上文档内容准确回答用户问题。注意理解问题中的指代关系和上下文含义。`

  return systemPrompt
}
```

#### 1.2 修改 `src/services/rag/retrievalService.ts`

```typescript
async retrieveContext(...) {
  const {
    topK = 5,
    minScore = 0.2,  // 🔧 从0.3降低到0.2，允许更泛化的匹配
    useCache = true
  } = options
  
  // ... 其他代码不变
}
```

#### 1.3 修改 `src/services/rag/answerService.ts`

```typescript
async *generateAnswer(...) {
  // ... 前面代码不变
  
  // 🆕 获取文档元信息用于Prompt优化
  let documentMetadata: { filename?: string; type?: string } | undefined
  try {
    const [doc] = await db
      .select({ filename: documents.filename, type: documents.type })
      .from(documents)
      .where(eq(documents.id, retrievalResult.documentId))
    documentMetadata = doc
  } catch (error) {
    // 忽略错误，不影响主流程
  }

  // 4. 构建System Prompt（传入文档元信息）
  const systemPrompt = buildSystemPrompt(
    truncatedChunks,
    documentMetadata  // 🆕 传入元信息
  )
  
  // ... 后面代码不变
}
```

**效果预期**:
- ✅ 解决 70% 的指代词问题
- ✅ 响应时间无变化
- ✅ 成本无增加
- ⚠️ 但治标不治本，检索质量仍有提升空间

---

### 方案2️⃣：查询改写 (2天开发) - 推荐！

**策略**: 在向量检索前，用LLM将泛化查询改写为具体查询

#### 2.1 创建查询改写服务

```typescript
// src/services/rag/queryRewriter.ts

import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { llmConfig } from '@/config/llm.config'
import type { ChatMessage } from '@/infrastructure/llm/llm-repository.interface'

/**
 * 查询改写服务
 * 将泛化查询（含指代词）改写为具体查询，提升检索效果
 */
export class QueryRewriter {
  private llm = LLMRepositoryFactory.create(llmConfig)

  /**
   * 改写查询（利用对话历史）
   * 
   * @param query 原始查询
   * @param conversationHistory 对话历史（最近3轮）
   * @param documentSummary 文档摘要（可选）
   * @returns 改写后的查询
   */
  async rewrite(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    documentSummary?: string
  ): Promise<{ 
    rewrittenQuery: string
    needsRewrite: boolean
    reasoning: string
  }> {
    // 1. 快速判断是否需要改写
    const needsRewrite = this.needsRewriting(query)
    
    if (!needsRewrite) {
      return {
        rewrittenQuery: query,
        needsRewrite: false,
        reasoning: '查询已足够具体，无需改写'
      }
    }

    // 2. 构建改写Prompt
    let contextInfo = ''
    if (conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-3) // 最近3轮
      contextInfo = '\n## 对话历史：\n' + 
        recent.map(msg => `${msg.role}: ${msg.content}`).join('\n')
    }
    
    if (documentSummary) {
      contextInfo += `\n## 文档摘要：\n${documentSummary}`
    }

    const rewritePrompt = `你是一个查询改写专家。请将用户的泛化查询改写为更具体、更适合向量检索的查询。

${contextInfo}

## 原始查询：
${query}

## 改写规则：
1. 将指代词替换为具体实体（如"这个人"→"张三"）
2. 补充关键信息使查询更具体
3. 保持查询的语义不变
4. 如果缺少上下文无法改写，保持原样

请以JSON格式回答：
\`\`\`json
{
  "rewrittenQuery": "改写后的查询",
  "reasoning": "改写理由"
}
\`\`\`

只返回JSON，不要其他内容。`

    // 3. 调用LLM改写
    const response = await this.llm.generateChatCompletion(
      [{ role: 'user', content: rewritePrompt }],
      { temperature: 0.1, maxTokens: 200 }
    )

    // 4. 解析结果
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/\{[\s\S]*?\}/)
      
      if (!jsonMatch) {
        throw new Error('无法解析JSON响应')
      }
      
      const result = JSON.parse(jsonMatch[1] || jsonMatch[0])
      
      return {
        rewrittenQuery: result.rewrittenQuery || query,
        needsRewrite: true,
        reasoning: result.reasoning || '改写完成'
      }
    } catch (error) {
      // 改写失败，返回原查询
      console.warn('Query rewriting failed:', error)
      return {
        rewrittenQuery: query,
        needsRewrite: true,
        reasoning: '改写失败，使用原查询'
      }
    }
  }

  /**
   * 判断查询是否需要改写
   * 
   * 需要改写的信号：
   * - 包含指代词（这/那/该/此/其）
   * - 包含人称代词（他/她/它/他们）
   * - 非常短（<5个字）
   */
  private needsRewriting(query: string): boolean {
    // 指代词和人称代词列表
    const pronouns = [
      '这个', '那个', '该', '此', '其',
      '他', '她', '它', '他们', '她们',
      '这位', '那位', '这家', '那家',
      '这种', '那种', '这些', '那些'
    ]
    
    // 检查是否包含指代词
    const hasPronouns = pronouns.some(p => query.includes(p))
    
    // 检查是否非常短
    const veryShort = query.length < 5
    
    return hasPronouns || veryShort
  }
}

// 导出单例
export const queryRewriter = new QueryRewriter()
```

#### 2.2 集成到检索服务

```typescript
// src/services/rag/retrievalService.ts

import { queryRewriter } from './queryRewriter'

export class RetrievalService {
  async retrieveContext(
    query: string,
    documentId: string,
    userId: string,
    options: RetrievalOptions & {
      conversationHistory?: Array<{ role: string; content: string }>
    } = {}
  ): Promise<RetrievalResult> {
    // ... 前面代码不变
    
    // 🆕 2.5. 查询改写（在向量化之前）
    let effectiveQuery = trimmedQuery
    if (options.conversationHistory && options.conversationHistory.length > 0) {
      const rewriteResult = await queryRewriter.rewrite(
        trimmedQuery,
        options.conversationHistory
      )
      
      if (rewriteResult.needsRewrite) {
        effectiveQuery = rewriteResult.rewrittenQuery
        
        logger.info({
          originalQuery: sanitizeQuery(trimmedQuery),
          rewrittenQuery: sanitizeQuery(effectiveQuery),
          reasoning: rewriteResult.reasoning,
          action: 'query_rewrite_success'
        }, 'Query rewritten for better retrieval')
      }
    }

    // 3. 并行执行：文档权限验证 + 查询向量化（使用改写后的查询）
    const [, queryVector] = await Promise.all([
      this.verifyDocumentAccess(documentId, userId),
      queryVectorizer.vectorizeQuery(effectiveQuery)  // 🔧 使用改写后的查询
    ])

    // ... 后面代码不变
  }
}
```

#### 2.3 从API层传入对话历史

```typescript
// src/app/api/chat/route.ts (或类似的API入口)

// 调用检索服务时传入对话历史
const retrievalResult = await retrievalService.retrieveContext(
  query,
  documentId,
  userId,
  {
    topK: 5,
    conversationHistory: conversationHistory.slice(-3)  // 🆕 最近3轮对话
  }
)
```

**效果预期**:
- ✅ 解决 90% 的指代词问题
- ✅ 同时提升一般查询的检索质量
- ⚠️ 响应时间增加 0.3-0.5秒（多一次LLM调用）
- ⚠️ 成本增加 ~$5/月（查询改写使用小模型）

**性能优化技巧**:
```typescript
// 使用更便宜的小模型做改写
const rewriteLLM = LLMRepositoryFactory.create({
  provider: 'zhipu',
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY,
    model: 'glm-3-turbo'  // 使用最便宜的模型
  }
})
```

---

### 方案3️⃣：完整解决方案 (3-4天开发)

**策略**: 查询改写 + HyDE + 混合检索 + 重排序

基于方案2，叠加我之前提到的增强型RAG技术：

```
用户查询: "这个人的工作经验？"
    ↓
[查询改写] → "张三的工作经验？"
    ↓
[HyDE扩展] → "张三，2020-2023年在阿里巴巴担任..."（假设文档）
    ↓
[混合检索]
    ├─ 向量检索(改写后的查询) → TopK 20
    └─ BM25检索("张三" + "工作经验") → TopK 20
    ↓
[RRF融合] → TopK 20
    ↓
[CrossEncoder重排序] → TopK 5（最相关的5个）
    ↓
[LLM生成] → "张三在2020-2023年担任阿里巴巴高级工程师..."
```

详细实现参考 `docs/architecture/rag-enhancement-proposal.md`

**效果预期**:
- ✅ 解决 95%+ 的指代词问题
- ✅ 全面提升检索质量
- ⚠️ 响应时间增加 0.5-1秒
- ⚠️ 成本增加 ~$45/月

---

## 📊 方案对比

| 维度 | 方案1 快速修复 | 方案2 查询改写 | 方案3 完整方案 |
|------|---------------|---------------|---------------|
| **开发工作量** | 0.5天 | 2天 | 3-4天 |
| **效果提升** | 70% | 90% | 95%+ |
| **响应时间影响** | 0秒 | +0.3-0.5秒 | +0.5-1秒 |
| **月度成本增加** | $0 | ~$5 | ~$45 |
| **技术债务** | 治标不治本 | 基本解决 | 彻底解决 |
| **后续扩展性** | 差 | 中 | 优 |

## 🎯 推荐实施路径

### 立即实施（本周）
**方案2：查询改写** - 投入产出比最高

**理由**:
1. 2天开发可以解决90%的问题
2. 成本增加极低（$5/月）
3. 响应时间增加可接受（0.3-0.5秒）
4. 技术实现简单，风险低
5. 为后续增强打好基础

### 中期规划（1个月后）
根据用户反馈和数据，评估是否需要实施方案3的其他增强功能

---

## 🔧 实施清单（方案2）

### 开发任务（2天）

**Day 1: 查询改写服务**
- [ ] 创建 `src/services/rag/queryRewriter.ts`
- [ ] 实现 `rewrite()` 方法
- [ ] 实现 `needsRewriting()` 判断逻辑
- [ ] 单元测试（至少5个测试用例）

**Day 2: 集成和测试**
- [ ] 修改 `retrievalService.ts` 集成查询改写
- [ ] 修改API层传入对话历史
- [ ] 端到端测试（简历、合同、产品文档各3个）
- [ ] 性能测试（确保响应时间符合预期）
- [ ] 监控埋点（记录改写成功率、效果等）

### 测试用例

```typescript
// tests/unit/queryRewriter.test.ts

describe('QueryRewriter', () => {
  it('应该改写包含"这个人"的查询', async () => {
    const result = await queryRewriter.rewrite(
      '这个人的工作经验是什么？',
      [
        { role: 'user', content: '上传了张三的简历' },
        { role: 'assistant', content: '已成功处理张三的简历' }
      ]
    )
    
    expect(result.needsRewrite).toBe(true)
    expect(result.rewrittenQuery).toContain('张三')
  })

  it('应该保持具体查询不变', async () => {
    const result = await queryRewriter.rewrite(
      '张三在阿里巴巴的工作经验',
      []
    )
    
    expect(result.needsRewrite).toBe(false)
    expect(result.rewrittenQuery).toBe('张三在阿里巴巴的工作经验')
  })

  // ... 更多测试用例
})
```

### 监控指标

添加以下监控埋点：

```typescript
logger.info({
  originalQuery: sanitizeQuery(query),
  rewrittenQuery: sanitizeQuery(rewrittenQuery),
  rewriteTime: rewriteMs,
  needsRewrite: boolean,
  hasConversationHistory: boolean,
  action: 'query_rewrite'
})
```

**关注指标**:
- 查询改写触发率
- 改写后检索成功率
- 改写耗时 (P50/P95)
- 改写失败率

---

## ⚠️ 风险和注意事项

### 风险1: 查询改写错误

**场景**: LLM可能错误理解上下文，将查询改写错了

**缓解措施**:
1. 改写失败时fallback到原查询
2. 记录所有改写结果用于监控
3. 提供用户反馈机制（"答案不对？点击重试"）

### 风险2: 响应时间增加

**场景**: 多一次LLM调用会增加延迟

**缓解措施**:
1. 使用最快的小模型（glm-3-turbo）
2. 设置查询改写超时（500ms，超时则用原查询）
3. 只在需要时才改写（通过 `needsRewriting()` 判断）

### 风险3: 成本增加

**场景**: 每个查询多一次LLM调用

**缓解措施**:
1. 使用最便宜的模型（GLM-3-Turbo: ¥0.005/1K tokens）
2. 查询改写通常<200 tokens，成本极低
3. 预估: 1000次查询/月 × 200 tokens × ¥0.005/1K ≈ ¥1（$0.15）

---

## 📈 效果验证

### 验收标准

实施方案2后，应达到以下指标：

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|----------|
| 指代词查询成功率 | ~30% | **≥90%** | 人工标注50个测试用例 |
| 查询改写触发率 | 0% | 20-30% | 日志统计 |
| 平均响应时间 | 2.5s | **≤3.0s** | P95监控 |
| 用户满意度 | 3.2/5 | **≥4.0/5** | 问卷调查 |

### A/B测试方案

```
用户分流:
- 50% → 旧版本（无查询改写）
- 50% → 新版本（有查询改写）

对比指标:
- 查询成功率
- 用户满意度
- 响应时间
- 成本

运行时长: 1周
样本量: 至少500个查询
```

---

## 🔗 相关文档

- [RAG增强方案总体设计](./rag-enhancement-proposal.md)
- [查询向量化缓存设计](./query-embedding-cache-design.md)
- [Epic 4: 质量改进](../prd/epic-4-quality-improvements.md)

---

## 📝 附录：实现代码框架

### 完整的 QueryRewriter 类

```typescript
// src/services/rag/queryRewriter.ts

import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { logger } from '@/lib/logger'

export interface QueryRewriteResult {
  rewrittenQuery: string
  needsRewrite: boolean
  reasoning: string
  rewriteTime: number
}

export class QueryRewriter {
  private llm = LLMRepositoryFactory.create({
    provider: 'zhipu',
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY || '',
      model: 'glm-3-turbo'  // 使用最便宜快速的模型
    }
  })

  async rewrite(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    documentSummary?: string
  ): Promise<QueryRewriteResult> {
    const startTime = Date.now()

    try {
      // 1. 判断是否需要改写
      const needsRewrite = this.needsRewriting(query)
      
      if (!needsRewrite) {
        return {
          rewrittenQuery: query,
          needsRewrite: false,
          reasoning: '查询已足够具体',
          rewriteTime: Date.now() - startTime
        }
      }

      // 2. 构建上下文
      let contextInfo = ''
      if (conversationHistory.length > 0) {
        const recent = conversationHistory.slice(-3)
        contextInfo = '\n## 对话历史：\n' + 
          recent.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      }
      
      if (documentSummary) {
        contextInfo += `\n## 文档信息：\n${documentSummary}`
      }

      // 3. 改写Prompt
      const rewritePrompt = `你是查询改写专家。将泛化查询改写为具体查询以提升检索效果。

${contextInfo}

## 原始查询：
"${query}"

## 改写规则：
1. 将指代词（这/那/该/他/她）替换为具体实体
2. 从对话历史中提取关键信息补充查询
3. 保持语义不变，只让查询更具体
4. 如果上下文不足以改写，保持原样

返回JSON：
{
  "rewrittenQuery": "改写后的查询",
  "reasoning": "改写理由"
}

只返回JSON，不要其他内容。`

      // 4. 调用LLM
      const response = await this.llm.generateChatCompletion(
        [{ role: 'user', content: rewritePrompt }],
        { 
          temperature: 0.1, 
          maxTokens: 200,
          timeout: 3000  // 3秒超时
        }
      )

      // 5. 解析结果
      const result = this.parseResponse(response)
      const rewriteTime = Date.now() - startTime

      logger.info({
        originalQuery: query.slice(0, 50),
        rewrittenQuery: result.rewrittenQuery.slice(0, 50),
        reasoning: result.reasoning,
        rewriteTime,
        action: 'query_rewrite_success'
      })

      return {
        rewrittenQuery: result.rewrittenQuery,
        needsRewrite: true,
        reasoning: result.reasoning,
        rewriteTime
      }

    } catch (error) {
      const rewriteTime = Date.now() - startTime
      
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        originalQuery: query.slice(0, 50),
        rewriteTime,
        action: 'query_rewrite_error'
      }, 'Query rewriting failed, using original query')

      return {
        rewrittenQuery: query,
        needsRewrite: true,
        reasoning: '改写失败，使用原查询',
        rewriteTime
      }
    }
  }

  private needsRewriting(query: string): boolean {
    // 指代词列表
    const pronouns = [
      '这个', '那个', '该', '此', '其',
      '他', '她', '它', '他们', '她们',
      '这位', '那位', '这家', '那家',
      '这种', '那种', '这些', '那些',
      '这里', '那里', '此处'
    ]
    
    const hasPronouns = pronouns.some(p => query.includes(p))
    const veryShort = query.length < 5
    
    return hasPronouns || veryShort
  }

  private parseResponse(response: string): { 
    rewrittenQuery: string
    reasoning: string 
  } {
    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/\{[\s\S]*?\}/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      
      const json = JSON.parse(jsonMatch[1] || jsonMatch[0])
      
      return {
        rewrittenQuery: json.rewrittenQuery || json.query || '',
        reasoning: json.reasoning || json.reason || '改写完成'
      }
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error}`)
    }
  }
}

export const queryRewriter = new QueryRewriter()
```

---

**END OF DOCUMENT**


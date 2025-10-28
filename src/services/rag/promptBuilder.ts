/**
 * Prompt Builder - Prompt工程
 * Story 3.3: LLM回答生成与流式输出
 * 
 * 负责构建高质量的System Prompt和上下文格式化
 */

export interface RetrievalChunk {
  id: string
  content: string
  score: number
  chunkIndex: number
  metadata?: Record<string, unknown>
}

/**
 * 构建System Prompt
 * 包含文档上下文和回答指令
 * 
 * @param chunks 检索到的文档片段
 * @returns 完整的System Prompt
 */
export function buildSystemPrompt(chunks: RetrievalChunk[]): string {
  // 1. 格式化上下文 - 使用[1][2]编号
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n')

  // 2. 构建完整Prompt
  const systemPrompt = `你是一个专业的文档问答助手。请基于以下文档内容回答用户的问题。

## 重要指令：
1. 只使用提供的文档内容回答，不要编造信息
2. 如果答案不在文档中，请明确说明"根据提供的文档无法回答该问题"
3. 使用[1][2]等编号标注引用来源，对应下方文档片段编号
4. 保持回答简洁、准确、专业
5. 避免过度推测或主观判断

## 文档内容：
${context}

请基于以上文档内容，准确回答用户问题。`

  return systemPrompt
}

/**
 * 估算Token数量
 * 粗略估算：1 token ≈ 4个字符（中文）或 1个单词（英文）
 * 
 * @param text 输入文本
 * @returns 估算的token数
 */
export function estimateTokenCount(text: string): number {
  // 简单估算：按字符数除以4
  return Math.ceil(text.length / 4)
}

/**
 * 截断上下文以满足Token限制
 * 
 * @param chunks 文档片段
 * @param maxTokens 最大token数
 * @returns 截断后的文档片段
 */
export function truncateContext(
  chunks: RetrievalChunk[],
  maxTokens: number = 2000
): RetrievalChunk[] {
  let totalTokens = 0
  const result: RetrievalChunk[] = []

  for (const chunk of chunks) {
    const chunkTokens = estimateTokenCount(chunk.content)
    if (totalTokens + chunkTokens > maxTokens) {
      break
    }
    result.push(chunk)
    totalTokens += chunkTokens
  }

  return result
}

/**
 * 验证Prompt长度
 * 
 * @param systemPrompt System Prompt
 * @param userMessage 用户消息
 * @param conversationHistory 对话历史
 * @returns 是否超过限制
 */
export function validatePromptLength(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): { valid: boolean; totalTokens: number; maxTokens: number } {
  const systemTokens = estimateTokenCount(systemPrompt)
  const userTokens = estimateTokenCount(userMessage)
  const historyTokens = conversationHistory.reduce(
    (sum, msg) => sum + estimateTokenCount(msg.content),
    0
  )

  const totalTokens = systemTokens + userTokens + historyTokens
  const maxTokens = 3000 // 安全限制

  return {
    valid: totalTokens <= maxTokens,
    totalTokens,
    maxTokens
  }
}

/**
 * LLM Repository接口
 * 支持多种LLM提供商(OpenAI、智谱AI等)
 */
export interface ILLMRepository {
  /**
   * 生成单个文本的embedding向量
   * @param text 输入文本
   * @returns 向量数组(维度取决于提供商: Zhipu=1024, OpenAI=1536)
   */
  generateEmbedding(text: string): Promise<number[]>

  /**
   * 批量生成embeddings
   * @param texts 输入文本数组
   * @returns 向量数组的数组
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>

  /**
   * 生成聊天回复
   * @param messages 消息历史
   * @param systemPrompt 系统提示词
   * @returns AI回复文本
   */
  generateChatCompletion(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string>
}

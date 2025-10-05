import type { ILLMRepository } from './llm-repository.interface'

/**
 * 智谱AI LLM实现
 * 使用GLM-4和embedding-2模型
 */
export class ZhipuRepository implements ILLMRepository {
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4'
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'embedding-2',
        input: text
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`智谱AI Embedding失败: ${error}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // 智谱AI支持批量embedding
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'embedding-2',
        input: texts
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`智谱AI Embeddings失败: ${error}`)
    }

    const data = await response.json()
    return data.data.map((item: any) => item.embedding)
  }

  async generateChatCompletion(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const chatMessages: Array<{ role: string; content: string }> = []
    
    if (systemPrompt) {
      chatMessages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    chatMessages.push(...messages)

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`智谱AI Chat失败: ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }
}

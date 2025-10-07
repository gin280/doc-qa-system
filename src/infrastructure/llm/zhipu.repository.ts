import type { ILLMRepository, ChatMessage, ChatCompletionOptions } from './llm-repository.interface'

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

  /**
   * 流式生成聊天回复（Story 3.3新增）
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 500,
        top_p: options?.topP ?? 0.9,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`智谱AI Stream失败: ${error}`)
    }

    if (!response.body) {
      throw new Error('智谱AI Stream响应body为空')
    }

    // 处理SSE流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        // 解码chunk并添加到buffer
        buffer += decoder.decode(value, { stream: true })
        
        // 按行分割
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后不完整的行

        for (const line of lines) {
          // SSE格式: data: {...}
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            
            // 跳过 [DONE] 标记
            if (jsonStr === '[DONE]') {
              continue
            }

            try {
              const data = JSON.parse(jsonStr)
              const content = data.choices?.[0]?.delta?.content
              
              if (content) {
                yield content
              }
            } catch (e) {
              // 忽略JSON解析错误（可能是不完整的数据）
              console.warn('智谱AI流式解析错误:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

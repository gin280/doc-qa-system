import OpenAI from 'openai'
import type { ILLMRepository, ChatMessage, ChatCompletionOptions } from './llm-repository.interface'

/**
 * OpenAI LLM实现
 */
export class OpenAIRepository implements ILLMRepository {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
    })
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })

    return response.data[0].embedding
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float'
    })

    return response.data.map(item => item.embedding)
  }

  async generateChatCompletion(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemPrompt) {
      chatMessages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    chatMessages.push(...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })))

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 2000
    })

    return response.choices[0]?.message?.content || ''
  }

  /**
   * 流式生成聊天回复（Story 3.3新增）
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 500,
      top_p: options?.topP ?? 0.9,
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }
}

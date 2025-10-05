import type { ILLMRepository } from './llm-repository.interface'
import { OpenAIRepository } from './openai.repository'
import { ZhipuRepository } from './zhipu.repository'

export interface LLMConfig {
  provider: 'openai' | 'zhipu'
  openai?: {
    apiKey: string
    model?: string
  }
  zhipu?: {
    apiKey: string
    model?: string
  }
}

/**
 * LLM Repository工厂
 * 根据配置返回对应的LLM提供商实现
 */
export class LLMRepositoryFactory {
  static create(config: LLMConfig): ILLMRepository {
    switch (config.provider) {
      case 'openai':
        if (!config.openai?.apiKey) {
          throw new Error('OpenAI API key is required')
        }
        return new OpenAIRepository(config.openai.apiKey)
      
      case 'zhipu':
        if (!config.zhipu?.apiKey) {
          throw new Error('Zhipu AI API key is required')
        }
        return new ZhipuRepository(config.zhipu.apiKey)
      
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`)
    }
  }
}

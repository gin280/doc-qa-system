import type { LLMConfig } from '@/infrastructure/llm/llm-repository.factory'

export const llmConfig: LLMConfig = {
  // 默认使用智谱AI (国内更方便)
  provider: (process.env.LLM_PROVIDER as 'openai' | 'zhipu') || 'zhipu',
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY || '',
    model: process.env.ZHIPU_MODEL || 'glm-4'
  }
}

/**
 * Embedding向量维度
 * 智谱AI embedding-2 固定为 1024维
 */
export const EMBEDDING_DIMENSION = 1024

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

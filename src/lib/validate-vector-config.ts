/**
 * 向量配置验证工具
 * 
 * 验证 LLM Provider 与 Embedding 维度配置的一致性
 */

import { llmConfig, EMBEDDING_DIMENSION } from '@/config/llm.config'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 获取Provider的预期向量维度
 */
export function getExpectedDimensionForProvider(provider: string): number {
  switch (provider) {
    case 'zhipu':
      return 1024
    case 'openai':
      return 1536
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * 验证向量维度配置
 * 
 * 检查 EMBEDDING_DIMENSION 是否与当前 provider 匹配
 */
export function validateVectorDimension(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  try {
    const expectedDim = getExpectedDimensionForProvider(llmConfig.provider)
    
    if (EMBEDDING_DIMENSION !== expectedDim) {
      result.valid = false
      result.errors.push(
        `Dimension mismatch: Provider '${llmConfig.provider}' requires ${expectedDim}D, ` +
        `but EMBEDDING_DIMENSION is set to ${EMBEDDING_DIMENSION}D. ` +
        `Update src/config/llm.config.ts to fix this.`
      )
    }
    
    // 可选：如果系统已有向量数据，警告配置变更风险
    if (process.env.NODE_ENV === 'production') {
      result.warnings.push(
        `Changing provider or dimension in production requires re-processing all documents. ` +
        `See docs/deployment/dimension-migration.md for migration guide.`
      )
    }
    
  } catch (error: unknown) {
    result.valid = false
    result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

/**
 * 在应用启动时调用，验证配置
 * 可选：可以在 middleware 或 API route 中调用
 */
export function assertValidVectorConfig(): void {
  const result = validateVectorDimension()
  
  if (!result.valid) {
    const errorMsg = `[Vector Config] Invalid configuration:\n${result.errors.join('\n')}`
    console.error(errorMsg)
    
    // 开发环境抛出错误，生产环境仅警告
    if (process.env.NODE_ENV === 'development') {
      throw new Error(errorMsg)
    }
  }
  
  if (result.warnings.length > 0) {
    console.warn('[Vector Config] Warnings:', result.warnings)
  }
  
  if (result.valid) {
    console.log(`[Vector Config] ✓ Configuration valid: ${llmConfig.provider} @ ${EMBEDDING_DIMENSION}D`)
  }
}


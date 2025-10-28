/**
 * Answer Service - LLM回答生成服务
 * Story 3.3: LLM回答生成与流式输出
 * 
 * 基于检索结果生成AI回答（流式）
 */

import { LLMRepositoryFactory } from '@/infrastructure/llm/llm-repository.factory'
import { llmConfig } from '@/config/llm.config'
import { buildSystemPrompt, estimateTokenCount, truncateContext } from './promptBuilder'
import { conversationService } from '@/services/chat/conversationService'
import type { ChatMessage } from '@/infrastructure/llm/llm-repository.interface'
import { logger } from '@/lib/logger'

export interface RetrievalResult {
  chunks: Array<{
    id: string
    content: string
    score: number
    chunkIndex: number
    metadata?: Record<string, unknown>
  }>
  totalFound: number
  cached: boolean
  retrievalTime: number
}

export interface GenerateAnswerOptions {
  temperature?: number
  maxTokens?: number
  includeHistory?: boolean
}

/**
 * LLM回答生成服务
 */
export class AnswerService {
  /**
   * 生成AI回答（流式）
   * 
   * @param query 用户问题
   * @param retrievalResult Story 3.2的检索结果
   * @param conversationId 对话ID（可选）
   * @param options 生成选项
   * @returns AsyncIterable<string> 流式文本chunks
   */
  async *generateAnswer(
    query: string,
    retrievalResult: RetrievalResult,
    conversationId: string | null,
    options: GenerateAnswerOptions = {}
  ): AsyncIterable<string> {
    const startTime = Date.now()
    let firstChunkTime: number | null = null
    const TOTAL_TIMEOUT = 30000 // 30秒总体超时
    const FIRST_CHUNK_TIMEOUT = 5000 // 5秒首字节超时

    try {
      // 1. 评估问题复杂度
      const complexity = this.assessComplexity(query)
      
      // 2. 动态计算 maxTokens
      // 优先使用用户指定值，否则根据复杂度自动设置
      const dynamicMaxTokens = this.calculateMaxTokens(complexity)
      const maxTokens = options.maxTokens ?? dynamicMaxTokens
      
      logger.debug({
        complexity,
        dynamicMaxTokens,
        userSpecified: options.maxTokens,
        finalMaxTokens: maxTokens,
        action: 'generation_token_allocation'
      }, 'Dynamic token allocation')
      
      // 3. 选择LLM提供商（智能路由）
      // 目前简化实现：使用配置中的提供商
      // TODO: 未来可以实现智能路由逻辑（AC6）
      const llm = LLMRepositoryFactory.create(llmConfig)

      // 3. 截断上下文以满足Token限制
      const truncatedChunks = truncateContext(retrievalResult.chunks, 2000)

      // 4. 构建System Prompt
      const systemPrompt = buildSystemPrompt(truncatedChunks)
      
      // 5. 获取对话历史（如果需要）
      const conversationHistory: ChatMessage[] = []
      if (options.includeHistory && conversationId) {
        try {
          const history = await conversationService.getConversationHistory(conversationId, 10)
          
          // 转换为ChatMessage格式
          for (const msg of history) {
            conversationHistory.push({
              role: msg.role === 'USER' ? 'user' : 'assistant',
              content: msg.content
            })
          }
        } catch (error) {
          logger.warn({
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            action: 'generation_history_load_error'
          }, 'Failed to load conversation history')
          // 继续执行，不因为历史加载失败而中断
        }
      }

      // 6. 验证Prompt长度
      const promptValidation = this.validatePromptLength(
        systemPrompt,
        query,
        conversationHistory
      )

      if (!promptValidation.valid) {
        // 如果超过限制，截断历史
        logger.warn({
          totalTokens: promptValidation.totalTokens,
          originalHistoryLength: conversationHistory.length,
          action: 'generation_prompt_truncate'
        }, 'Prompt too long, truncating history')
        conversationHistory.splice(0, conversationHistory.length / 2)
      }

      // 7. 构建完整消息列表
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ]

      // 8. 流式生成回答（带超时控制）
      const stream = llm.streamChatCompletion(messages, {
        temperature: options.temperature ?? 0.1,
        maxTokens: maxTokens,  // 使用动态计算的值
        topP: 0.9
      })

      let totalChunks = 0
      for await (const chunk of stream) {
        const now = Date.now()
        
        // 检查首字节超时
        if (totalChunks === 0) {
          firstChunkTime = now
          if (now - startTime > FIRST_CHUNK_TIMEOUT) {
            logger.error({
              elapsed: now - startTime,
              threshold: FIRST_CHUNK_TIMEOUT,
              action: 'generation_first_chunk_timeout'
            }, 'First chunk timeout exceeded')
            throw new Error('GENERATION_TIMEOUT')
          }
        }
        
        // 检查总体超时
        if (now - startTime > TOTAL_TIMEOUT) {
          logger.error({
            elapsed: now - startTime,
            threshold: TOTAL_TIMEOUT,
            chunksReceived: totalChunks,
            action: 'generation_total_timeout'
          }, 'Total timeout exceeded')
          throw new Error('GENERATION_TIMEOUT')
        }
        
        totalChunks++
        yield chunk
      }

      const elapsed = Date.now() - startTime
      const firstChunkLatency = firstChunkTime ? firstChunkTime - startTime : 0

      // 记录生成成功
      logger.info({
        complexity,
        provider: llmConfig.provider,
        generationTime: elapsed,
        firstChunkLatency,
        totalChunks,
        maxTokens,
        action: 'generation_success'
      }, 'Answer generation completed')

    } catch (error) {
      const elapsed = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 记录生成失败
      logger.error({
        error: errorMessage,
        generationTime: elapsed,
        action: 'generation_error'
      }, 'Answer generation failed')

      // 友好错误处理
      if (errorMessage.includes('timeout')) {
        throw new Error('GENERATION_TIMEOUT')
      } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        throw new Error('QUOTA_EXCEEDED')
      } else {
        throw new Error('GENERATION_ERROR')
      }
    }
  }

  /**
   * 评估问题复杂度（增强版）
   * 
   * @param query 用户问题
   * @returns 复杂度等级
   */
  private assessComplexity(query: string): 'simple' | 'complex' {
    // 1. 复杂问题关键词（扩展列表）
    const complexKeywords = [
      '分析', '对比', '比较', '详细', '深入', 
      '为什么', '如何', '解释', '原理', '机制',
      '优缺点', '区别', '评估', '总结'
    ]
    
    const hasComplexKeyword = complexKeywords.some(kw => query.includes(kw))
    
    // 2. 长度判断 (阈值: 40字符)
    const isLong = query.length > 40
    
    // 3. 多个问号判断
    const questionMarkCount = (query.match(/？|\?/g) || []).length
    const hasMultipleQuestions = questionMarkCount > 1
    
    // 4. 包含列表或编号
    const hasListIndicators = /[1-9]\.|[一二三四五]、|•|·/.test(query)
    
    // 综合判断
    if (hasComplexKeyword || isLong || hasMultipleQuestions || hasListIndicators) {
      return 'complex'
    }
    
    return 'simple'
  }

  /**
   * 根据复杂度计算合适的 maxTokens
   * 
   * @param complexity 问题复杂度
   * @returns 建议的 maxTokens
   */
  private calculateMaxTokens(complexity: 'simple' | 'complex'): number {
    const TOKEN_CONFIG = {
      simple: 300,   // 简单问题: 简短回答
      complex: 500   // 复杂问题: 详细回答
    }
    
    return TOKEN_CONFIG[complexity]
  }

  /**
   * 验证Prompt长度
   * 
   * @param systemPrompt System Prompt
   * @param userMessage 用户消息
   * @param conversationHistory 对话历史
   * @returns 验证结果
   */
  private validatePromptLength(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ChatMessage[]
  ): { valid: boolean; totalTokens: number } {
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
      totalTokens
    }
  }
}

// 导出单例
export const answerService = new AnswerService()

/**
 * Ragas评估相关类型定义
 * 
 * 用于RAG系统质量评估的数据结构
 */

/**
 * Ragas评估指标
 * 所有分数范围: 0-1，越高越好
 */
export interface RagasMetrics {
  /** 检索精确度 - 检索到的上下文中有多少是相关的 */
  context_precision: number;
  
  /** 检索召回率 - 所有相关上下文中有多少被检索到 */
  context_recall: number;
  
  /** 答案忠实度 - 生成的答案是否忠实于上下文（无幻觉） */
  faithfulness: number;
  
  /** 答案相关性 - 生成的答案与问题的相关程度 */
  answer_relevancy: number;
  
  /** 综合分数 - 上述4个指标的平均值 */
  ragas_score: number;
}

/**
 * 单个测试用例
 */
export interface TestCase {
  /** 用户问题 */
  question: string;
  
  /** 生成的答案（可选，如果需要评估答案质量） */
  answer?: string;
  
  /** 检索到的上下文列表（可选） */
  contexts?: string[];
  
  /** 标准答案/真实答案（可选，用于评估召回率） */
  groundTruth?: string;
}

/**
 * 评估报告
 */
export interface EvaluationReport {
  /** 测试用例总数 */
  totalCases: number;
  
  /** 平均评估指标 */
  metrics: RagasMetrics;
  
  /** 失败的测试用例 */
  failedCases: Array<{
    question: string;
    error: string;
  }>;
  
  /** 评估总耗时（毫秒） */
  duration: number;
  
  /** 评估开始时间 */
  startTime: Date;
  
  /** 评估结束时间 */
  endTime: Date;
}

/**
 * 评估选项
 */
export interface EvaluationOptions {
  /** Ragas API URL */
  apiUrl?: string;
  
  /** 超时时间（毫秒），默认30秒 */
  timeout?: number;
  
  /** 批量评估时的并发数，默认5 */
  concurrency?: number;
  
  /** 是否记录详细日志 */
  verbose?: boolean;
}

/**
 * Ragas API 请求
 */
export interface RagasEvaluateRequest {
  question: string;
  answer: string;
  contexts: string[];
  ground_truth?: string;
}

/**
 * Ragas API 响应
 */
export interface RagasEvaluateResponse {
  context_precision: number;
  context_recall: number;
  faithfulness: number;
  answer_relevancy: number;
  ragas_score: number;
}


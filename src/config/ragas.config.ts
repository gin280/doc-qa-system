/**
 * Ragas评估服务配置
 * 
 * 用于配置Ragas API连接和评估参数
 */

export interface RagasConfig {
  /** Ragas API URL */
  apiUrl: string;
  
  /** 是否启用Ragas评估（可选功能） */
  enabled: boolean;
  
  /** 默认超时时间（毫秒） */
  timeout: number;
  
  /** 批量评估时的并发数 */
  concurrency: number;
  
  /** 是否记录详细日志 */
  verbose: boolean;
}

export const ragasConfig: RagasConfig = {
  apiUrl: process.env.RAGAS_API_URL || 'http://localhost:8000',
  enabled: process.env.RAGAS_ENABLED === 'true',
  timeout: parseInt(process.env.RAGAS_TIMEOUT || '30000', 10),
  concurrency: parseInt(process.env.RAGAS_CONCURRENCY || '5', 10),
  verbose: process.env.RAGAS_VERBOSE === 'true',
};


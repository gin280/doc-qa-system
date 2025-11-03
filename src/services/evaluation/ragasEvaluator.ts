/**
 * Ragas评估服务
 * 
 * 负责调用Ragas API进行RAG系统质量评估
 */

import { logger } from '@/lib/logger';
import type {
  RagasMetrics,
  TestCase,
  EvaluationReport,
  EvaluationOptions,
  RagasEvaluateRequest,
  RagasEvaluateResponse,
} from '@/types/evaluation';

export class RagasEvaluator {
  private apiUrl: string;
  private timeout: number;
  private concurrency: number;
  private verbose: boolean;

  constructor(options?: EvaluationOptions) {
    this.apiUrl = options?.apiUrl || process.env.RAGAS_API_URL || 'http://localhost:8000';
    this.timeout = options?.timeout || 30000; // 30秒默认超时
    this.concurrency = options?.concurrency || 5; // 默认并发数5
    this.verbose = options?.verbose || false;
  }

  /**
   * 评估单个问答对
   * 
   * @param params - 评估参数
   * @returns Ragas评估指标
   */
  async evaluateQA(params: {
    question: string;
    answer: string;
    contexts: string[];
    groundTruth?: string;
  }): Promise<RagasMetrics> {
    const startTime = Date.now();

    try {
      // 输入验证
      this.validateInput(params);

      if (this.verbose) {
        logger.info('Ragas evaluation started', {
          question: params.question.substring(0, 50) + '...',
          contextsCount: params.contexts.length,
        });
      }

      // 构建请求
      const request: RagasEvaluateRequest = {
        question: params.question,
        answer: params.answer,
        contexts: params.contexts,
      };

      if (params.groundTruth) {
        request.ground_truth = params.groundTruth;
      }

      // 调用Ragas API
      const response = await this.callRagasApi(request);

      const duration = Date.now() - startTime;

      if (this.verbose) {
        logger.info('Ragas evaluation completed', {
          duration,
          ragas_score: response.ragas_score,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Ragas evaluation failed', {
        question: params.question.substring(0, 50) + '...',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 批量评估测试集
   * 
   * @param testCases - 测试用例数组
   * @returns 评估报告
   */
  async evaluateDataset(testCases: TestCase[]): Promise<EvaluationReport> {
    const startTime = new Date();
    const failedCases: Array<{ question: string; error: string }> = [];
    const results: RagasMetrics[] = [];

    logger.info('Ragas dataset evaluation started', {
      totalCases: testCases.length,
      concurrency: this.concurrency,
    });

    try {
      // 批量评估，控制并发
      for (let i = 0; i < testCases.length; i += this.concurrency) {
        const batch = testCases.slice(i, i + this.concurrency);
        const batchPromises = batch.map(async (testCase) => {
          try {
            // 确保必要字段存在
            if (!testCase.answer || !testCase.contexts) {
              throw new Error('Test case must have answer and contexts');
            }

            const metrics = await this.evaluateQA({
              question: testCase.question,
              answer: testCase.answer,
              contexts: testCase.contexts,
              groundTruth: testCase.groundTruth,
            });

            results.push(metrics);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            failedCases.push({
              question: testCase.question,
              error: errorMessage,
            });
            logger.warn('Test case evaluation failed', {
              question: testCase.question.substring(0, 50) + '...',
              error: errorMessage,
            });
          }
        });

        await Promise.all(batchPromises);

        if (this.verbose) {
          logger.info('Batch completed', {
            batchStart: i + 1,
            batchEnd: Math.min(i + this.concurrency, testCases.length),
            total: testCases.length,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // 计算平均指标
      const avgMetrics = this.calculateAverageMetrics(results);

      const report: EvaluationReport = {
        totalCases: testCases.length,
        metrics: avgMetrics,
        failedCases,
        duration,
        startTime,
        endTime,
      };

      logger.info('Ragas dataset evaluation completed', {
        totalCases: testCases.length,
        successfulCases: results.length,
        failedCases: failedCases.length,
        duration,
        avgRagasScore: avgMetrics.ragas_score,
      });

      return report;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      logger.error('Ragas dataset evaluation failed', {
        totalCases: testCases.length,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 调用Ragas API
   * 
   * @private
   */
  private async callRagasApi(request: RagasEvaluateRequest): Promise<RagasMetrics> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiUrl}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ragas API error (${response.status}): ${errorText}`);
      }

      const data: RagasEvaluateResponse = await response.json();

      // 验证响应数据
      this.validateResponse(data);

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Ragas API timeout after ${this.timeout}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error calling Ragas API');
    }
  }

  /**
   * 验证输入参数
   * 
   * @private
   */
  private validateInput(params: {
    question: string;
    answer: string;
    contexts: string[];
  }): void {
    if (!params.question || params.question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    if (!params.answer || params.answer.trim().length === 0) {
      throw new Error('Answer cannot be empty');
    }

    if (!params.contexts || params.contexts.length === 0) {
      throw new Error('Contexts cannot be empty');
    }

    // 验证contexts中没有空字符串
    if (params.contexts.some((ctx) => !ctx || ctx.trim().length === 0)) {
      throw new Error('Contexts cannot contain empty strings');
    }
  }

  /**
   * 验证API响应
   * 
   * @private
   */
  private validateResponse(data: RagasEvaluateResponse): void {
    const requiredFields: (keyof RagasEvaluateResponse)[] = [
      'context_precision',
      'context_recall',
      'faithfulness',
      'answer_relevancy',
      'ragas_score',
    ];

    for (const field of requiredFields) {
      if (typeof data[field] !== 'number') {
        throw new Error(`Invalid response: missing or invalid field '${field}'`);
      }

      if (data[field] < 0 || data[field] > 1) {
        throw new Error(`Invalid response: field '${field}' must be between 0 and 1`);
      }
    }
  }

  /**
   * 计算平均指标
   * 
   * @private
   */
  private calculateAverageMetrics(results: RagasMetrics[]): RagasMetrics {
    if (results.length === 0) {
      return {
        context_precision: 0,
        context_recall: 0,
        faithfulness: 0,
        answer_relevancy: 0,
        ragas_score: 0,
      };
    }

    const sum = results.reduce(
      (acc, curr) => ({
        context_precision: acc.context_precision + curr.context_precision,
        context_recall: acc.context_recall + curr.context_recall,
        faithfulness: acc.faithfulness + curr.faithfulness,
        answer_relevancy: acc.answer_relevancy + curr.answer_relevancy,
        ragas_score: acc.ragas_score + curr.ragas_score,
      }),
      {
        context_precision: 0,
        context_recall: 0,
        faithfulness: 0,
        answer_relevancy: 0,
        ragas_score: 0,
      }
    );

    const count = results.length;

    return {
      context_precision: sum.context_precision / count,
      context_recall: sum.context_recall / count,
      faithfulness: sum.faithfulness / count,
      answer_relevancy: sum.answer_relevancy / count,
      ragas_score: sum.ragas_score / count,
    };
  }

  /**
   * 检查Ragas API健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      return response.ok;
    } catch (error) {
      logger.error('Ragas health check failed', {
        apiUrl: this.apiUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}


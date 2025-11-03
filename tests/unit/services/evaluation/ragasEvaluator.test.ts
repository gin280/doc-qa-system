/**
 * RagasEvaluator单元测试
 */

import { RagasEvaluator } from '@/services/evaluation/ragasEvaluator';
import type { RagasMetrics, TestCase } from '@/types/evaluation';

// Mock fetch
global.fetch = jest.fn();

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('RagasEvaluator', () => {
  let evaluator: RagasEvaluator;

  beforeEach(() => {
    evaluator = new RagasEvaluator({ apiUrl: 'http://test-api:8000' });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration when no options provided', () => {
      const defaultEvaluator = new RagasEvaluator();
      expect(defaultEvaluator).toBeInstanceOf(RagasEvaluator);
    });

    it('should use provided options', () => {
      const customEvaluator = new RagasEvaluator({
        apiUrl: 'http://custom:9000',
        timeout: 60000,
        concurrency: 10,
        verbose: true,
      });
      expect(customEvaluator).toBeInstanceOf(RagasEvaluator);
    });
  });

  describe('evaluateQA', () => {
    it('should return metrics for valid input', async () => {
      const mockResponse: RagasMetrics = {
        context_precision: 0.85,
        context_recall: 0.78,
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        ragas_score: 0.86,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await evaluator.evaluateQA({
        question: 'What is RAG?',
        answer: 'RAG is Retrieval-Augmented Generation...',
        contexts: ['RAG combines retrieval with generation...'],
      });

      expect(result).toEqual(mockResponse);
      expect(result.ragas_score).toBeGreaterThan(0.8);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api:8000/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include ground truth when provided', async () => {
      const mockResponse: RagasMetrics = {
        context_precision: 0.90,
        context_recall: 0.85,
        faithfulness: 0.95,
        answer_relevancy: 0.92,
        ragas_score: 0.91,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await evaluator.evaluateQA({
        question: 'Test question',
        answer: 'Test answer',
        contexts: ['Test context'],
        groundTruth: 'Expected answer',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api:8000/evaluate',
        expect.objectContaining({
          body: expect.stringContaining('ground_truth'),
        })
      );
    });

    it('should throw error when question is empty', async () => {
      await expect(
        evaluator.evaluateQA({
          question: '',
          answer: 'Test answer',
          contexts: ['Test context'],
        })
      ).rejects.toThrow('Question cannot be empty');
    });

    it('should throw error when answer is empty', async () => {
      await expect(
        evaluator.evaluateQA({
          question: 'Test question',
          answer: '',
          contexts: ['Test context'],
        })
      ).rejects.toThrow('Answer cannot be empty');
    });

    it('should throw error when contexts is empty', async () => {
      await expect(
        evaluator.evaluateQA({
          question: 'Test question',
          answer: 'Test answer',
          contexts: [],
        })
      ).rejects.toThrow('Contexts cannot be empty');
    });

    it('should throw error when contexts contains empty strings', async () => {
      await expect(
        evaluator.evaluateQA({
          question: 'Test question',
          answer: 'Test answer',
          contexts: ['Valid context', '', 'Another context'],
        })
      ).rejects.toThrow('Contexts cannot contain empty strings');
    });

    it('should handle API error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        evaluator.evaluateQA({
          question: 'Test',
          answer: 'Answer',
          contexts: ['Context'],
        })
      ).rejects.toThrow('Ragas API error (500): Internal Server Error');
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        evaluator.evaluateQA({
          question: 'Test',
          answer: 'Answer',
          contexts: ['Context'],
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      const shortTimeoutEvaluator = new RagasEvaluator({
        apiUrl: 'http://test-api:8000',
        timeout: 100,
      });

      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 200)
          )
      );

      await expect(
        shortTimeoutEvaluator.evaluateQA({
          question: 'Test',
          answer: 'Answer',
          contexts: ['Context'],
        })
      ).rejects.toThrow();
    });

    it('should throw error for invalid response (missing fields)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          context_precision: 0.85,
          // Missing other required fields
        }),
      });

      await expect(
        evaluator.evaluateQA({
          question: 'Test',
          answer: 'Answer',
          contexts: ['Context'],
        })
      ).rejects.toThrow('Invalid response');
    });

    it('should throw error for invalid response (out of range values)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          context_precision: 1.5, // Invalid: > 1
          context_recall: 0.78,
          faithfulness: 0.92,
          answer_relevancy: 0.88,
          ragas_score: 0.86,
        }),
      });

      await expect(
        evaluator.evaluateQA({
          question: 'Test',
          answer: 'Answer',
          contexts: ['Context'],
        })
      ).rejects.toThrow("field 'context_precision' must be between 0 and 1");
    });
  });

  describe('evaluateDataset', () => {
    const mockTestCases: TestCase[] = [
      {
        question: 'Question 1',
        answer: 'Answer 1',
        contexts: ['Context 1'],
      },
      {
        question: 'Question 2',
        answer: 'Answer 2',
        contexts: ['Context 2'],
      },
      {
        question: 'Question 3',
        answer: 'Answer 3',
        contexts: ['Context 3'],
      },
    ];

    it('should evaluate multiple test cases successfully', async () => {
      const mockMetrics: RagasMetrics = {
        context_precision: 0.85,
        context_recall: 0.78,
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        ragas_score: 0.86,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMetrics,
      });

      const report = await evaluator.evaluateDataset(mockTestCases);

      expect(report.totalCases).toBe(3);
      expect(report.metrics.ragas_score).toBe(0.86);
      expect(report.failedCases).toHaveLength(0);
      expect(report.duration).toBeGreaterThanOrEqual(0);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures', async () => {
      const mockMetrics: RagasMetrics = {
        context_precision: 0.85,
        context_recall: 0.78,
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        ragas_score: 0.86,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetrics,
        })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetrics,
        });

      const report = await evaluator.evaluateDataset(mockTestCases);

      expect(report.totalCases).toBe(3);
      expect(report.failedCases).toHaveLength(1);
      expect(report.failedCases[0].question).toBe('Question 2');
      expect(report.failedCases[0].error).toBe('API Error');
    });

    it('should calculate average metrics correctly', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            context_precision: 0.8,
            context_recall: 0.7,
            faithfulness: 0.9,
            answer_relevancy: 0.85,
            ragas_score: 0.81,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            context_precision: 0.9,
            context_recall: 0.8,
            faithfulness: 0.95,
            answer_relevancy: 0.92,
            ragas_score: 0.89,
          }),
        });

      const report = await evaluator.evaluateDataset(mockTestCases.slice(0, 2));

      expect(report.metrics.context_precision).toBeCloseTo(0.85, 2);
      expect(report.metrics.context_recall).toBeCloseTo(0.75, 2);
      expect(report.metrics.ragas_score).toBeCloseTo(0.85, 2);
    });

    it('should handle empty test cases', async () => {
      const report = await evaluator.evaluateDataset([]);

      expect(report.totalCases).toBe(0);
      expect(report.metrics.ragas_score).toBe(0);
      expect(report.failedCases).toHaveLength(0);
    });

    it('should throw error for test cases without answer', async () => {
      const invalidTestCases: TestCase[] = [
        {
          question: 'Question without answer',
          contexts: ['Context'],
        },
      ];

      const report = await evaluator.evaluateDataset(invalidTestCases);

      expect(report.failedCases).toHaveLength(1);
      expect(report.failedCases[0].error).toContain('must have answer and contexts');
    });

    it('should respect concurrency limit', async () => {
      const manyTestCases: TestCase[] = Array.from({ length: 10 }, (_, i) => ({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        contexts: [`Context ${i + 1}`],
      }));

      const mockMetrics: RagasMetrics = {
        context_precision: 0.85,
        context_recall: 0.78,
        faithfulness: 0.92,
        answer_relevancy: 0.88,
        ragas_score: 0.86,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMetrics,
      });

      const limitedEvaluator = new RagasEvaluator({
        apiUrl: 'http://test-api:8000',
        concurrency: 2,
      });

      const report = await limitedEvaluator.evaluateDataset(manyTestCases);

      expect(report.totalCases).toBe(10);
      expect(global.fetch).toHaveBeenCalledTimes(10);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const isHealthy = await evaluator.healthCheck();

      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api:8000/health',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when API is unhealthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      const isHealthy = await evaluator.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await evaluator.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});


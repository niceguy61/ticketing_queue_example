import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, retryWithCondition, retryWithTimeout } from './retry';

describe('Retry Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately on non-retryable error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Validation error'));
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Validation error');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 'ECONNREFUSED' });
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
      
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should retry on HTTP 5xx errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on HTTP 4xx errors', async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toMatchObject({ response: { status: 400 } });
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2
      });
      
      const duration = Date.now() - startTime;
      
      // Should wait at least 100ms + 200ms = 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryWithCondition', () => {
    it('should retry based on custom condition', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('success');
      
      const shouldRetry = (error: any) => error.message.includes('Temporary');
      
      const result = await retryWithCondition(fn, shouldRetry, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry when condition is false', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Permanent error'));
      
      const shouldRetry = (error: any) => error.message.includes('Temporary');
      
      await expect(
        retryWithCondition(fn, shouldRetry, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toThrow('Permanent error');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryWithTimeout', () => {
    it('should succeed within timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithTimeout(fn, 1000, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should timeout and retry', async () => {
      const fn = vi.fn()
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve('late'), 200)))
        .mockResolvedValue('success');
      
      const result = await retryWithTimeout(fn, 100, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries with timeout', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('late'), 200))
      );
      
      await expect(
        retryWithTimeout(fn, 100, { maxRetries: 2, initialDelayMs: 10 })
      ).rejects.toThrow('Operation timeout');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

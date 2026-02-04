import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, retryWithCondition, retryWithTimeout } from './retry';

describe('Retry Utilities - User Service', () => {
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

    it('should retry on database connection errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'connection refused' })
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 'ECONNREFUSED' });
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3, initialDelayMs: 10 })
      ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
      
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryWithCondition', () => {
    it('should retry based on custom condition', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Database temporarily unavailable'))
        .mockResolvedValue('success');
      
      const shouldRetry = (error: any) => error.message.includes('temporarily');
      
      const result = await retryWithCondition(fn, shouldRetry, {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
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
  });
});

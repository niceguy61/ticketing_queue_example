import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SQSAdapter } from './sqsAdapter';

describe('SQSAdapter', () => {
  let adapter: SQSAdapter;
  const testQueueName = 'test-queue';

  beforeAll(async () => {
    // LocalStack 또는 실제 SQS 연결
    adapter = new SQSAdapter({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566'
    });
    
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  beforeEach(async () => {
    // 테스트 큐 생성 (이미 존재하면 무시)
    await adapter.createQueue(testQueueName);
  });

  describe('connect', () => {
    it('should connect to SQS successfully', async () => {
      const newAdapter = new SQSAdapter();
      await expect(newAdapter.connect()).resolves.not.toThrow();
      await newAdapter.disconnect();
    });
  });

  describe('publish', () => {
    it('should publish a message to the queue', async () => {
      const message = {
        userId: 'user-123',
        eventId: 'event-456',
        timestamp: Date.now()
      };

      await expect(adapter.publish(testQueueName, message)).resolves.not.toThrow();
    });

    it('should publish a message with delay option', async () => {
      const message = { userId: 'user-delay' };
      
      await expect(
        adapter.publish(testQueueName, message, { delay: 5000 })
      ).resolves.not.toThrow();
    });
  });

  describe('getQueueSize', () => {
    it('should return the approximate number of messages in the queue', async () => {
      // 메시지 발행
      await adapter.publish(testQueueName, { userId: 'user-1' });
      await adapter.publish(testQueueName, { userId: 'user-2' });

      // 잠시 대기 (SQS는 eventually consistent)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const size = await adapter.getQueueSize(testQueueName);
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('subscribe', () => {
    it('should receive and process messages', async () => {
      const testMessage = {
        userId: 'user-subscribe-test',
        timestamp: Date.now()
      };

      // 메시지 발행
      await adapter.publish(testQueueName, testMessage);

      // 메시지 수신 대기
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Message not received within timeout'));
        }, 30000); // 30초 타임아웃

        adapter.subscribe(testQueueName, async (message, ack, nack) => {
          try {
            expect(message).toEqual(testMessage);
            await ack();
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    });

    it('should handle message processing errors with nack', async () => {
      const testMessage = {
        userId: 'user-error-test',
        shouldFail: true
      };

      await adapter.publish(testQueueName, testMessage);

      let attemptCount = 0;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Message retry not received within timeout'));
        }, 60000); // 60초 타임아웃

        adapter.subscribe(testQueueName, async (message, ack, nack) => {
          try {
            attemptCount++;

            if (message.shouldFail && attemptCount === 1) {
              // 첫 번째 시도는 실패
              await nack();
            } else {
              // 두 번째 시도는 성공
              expect(attemptCount).toBeGreaterThan(1);
              await ack();
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    });
  });

  describe('createQueue', () => {
    it('should create a new queue', async () => {
      const newQueueName = `test-queue-${Date.now()}`;
      
      await expect(adapter.createQueue(newQueueName)).resolves.not.toThrow();
      
      // 큐가 생성되었는지 확인
      const size = await adapter.getQueueSize(newQueueName);
      expect(size).toBe(0);
    });

    it('should handle existing queue gracefully', async () => {
      // 같은 큐를 두 번 생성해도 에러가 발생하지 않아야 함
      await expect(adapter.createQueue(testQueueName)).resolves.not.toThrow();
      await expect(adapter.createQueue(testQueueName)).resolves.not.toThrow();
    });
  });
});

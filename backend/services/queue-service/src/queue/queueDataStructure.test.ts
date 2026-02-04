import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import redisConnection from '../redis/connection';
import QueueDataStructure from './queueDataStructure';

describe('Queue Data Structure', () => {
  let queueDS: QueueDataStructure;
  const testQueueName = 'test:queue';

  beforeAll(async () => {
    await redisConnection.connect();
    queueDS = new QueueDataStructure();
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  beforeEach(async () => {
    // Clean up test queue before each test
    await queueDS.clearQueue(testQueueName);
  });

  describe('addToQueue', () => {
    it('should add user to queue', async () => {
      const result = await queueDS.addToQueue(testQueueName, 'user-1');
      expect(result).toBe(true);

      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(1);
    });

    it('should add multiple users to queue', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');
      await queueDS.addToQueue(testQueueName, 'user-3');

      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(3);
    });

    it('should add user with eventId', async () => {
      const result = await queueDS.addToQueue(testQueueName, 'user-1', 'event-123');
      expect(result).toBe(true);

      const entries = await queueDS.getQueueEntries(testQueueName);
      expect(entries[0].eventId).toBe('event-123');
    });
  });

  describe('getPosition', () => {
    it('should return correct position for user', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');
      await queueDS.addToQueue(testQueueName, 'user-3');

      const position1 = await queueDS.getPosition(testQueueName, 'user-1');
      const position2 = await queueDS.getPosition(testQueueName, 'user-2');
      const position3 = await queueDS.getPosition(testQueueName, 'user-3');

      expect(position1).toBe(0);
      expect(position2).toBe(1);
      expect(position3).toBe(2);
    });

    it('should return null for non-existent user', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');

      const position = await queueDS.getPosition(testQueueName, 'user-999');
      expect(position).toBeNull();
    });
  });

  describe('removeFromQueue', () => {
    it('should remove user from queue', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');

      const removed = await queueDS.removeFromQueue(testQueueName, 'user-1');
      expect(removed).toBe(1);

      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(1);
    });

    it('should return 0 when removing non-existent user', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');

      const removed = await queueDS.removeFromQueue(testQueueName, 'user-999');
      expect(removed).toBe(0);
    });
  });

  describe('getQueueSize', () => {
    it('should return 0 for empty queue', async () => {
      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(0);
    });

    it('should return correct size', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');
      await queueDS.addToQueue(testQueueName, 'user-3');

      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(3);
    });
  });

  describe('getNextUser', () => {
    it('should return first user in queue (FIFO)', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');

      const nextUser = await queueDS.getNextUser(testQueueName);
      expect(nextUser).not.toBeNull();
      expect(nextUser?.userId).toBe('user-1');
    });

    it('should return null for empty queue', async () => {
      const nextUser = await queueDS.getNextUser(testQueueName);
      expect(nextUser).toBeNull();
    });
  });

  describe('popNextUser', () => {
    it('should remove and return first user (FIFO)', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');

      const poppedUser = await queueDS.popNextUser(testQueueName);
      expect(poppedUser?.userId).toBe('user-1');

      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(1);

      const nextUser = await queueDS.getNextUser(testQueueName);
      expect(nextUser?.userId).toBe('user-2');
    });

    it('should return null for empty queue', async () => {
      const poppedUser = await queueDS.popNextUser(testQueueName);
      expect(poppedUser).toBeNull();
    });
  });

  describe('isUserInQueue', () => {
    it('should return true for user in queue', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');

      const inQueue = await queueDS.isUserInQueue(testQueueName, 'user-1');
      expect(inQueue).toBe(true);
    });

    it('should return false for user not in queue', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');

      const inQueue = await queueDS.isUserInQueue(testQueueName, 'user-999');
      expect(inQueue).toBe(false);
    });
  });

  describe('getQueuePositionInfo', () => {
    it('should return position info for user', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');
      await queueDS.addToQueue(testQueueName, 'user-2');
      await queueDS.addToQueue(testQueueName, 'user-3');

      const positionInfo = await queueDS.getQueuePositionInfo(testQueueName, 'user-2');
      expect(positionInfo).not.toBeNull();
      expect(positionInfo?.position).toBe(2); // 1-based
      expect(positionInfo?.totalWaiting).toBe(3);
    });

    it('should return null for non-existent user', async () => {
      await queueDS.addToQueue(testQueueName, 'user-1');

      const positionInfo = await queueDS.getQueuePositionInfo(testQueueName, 'user-999');
      expect(positionInfo).toBeNull();
    });
  });

  describe('FIFO ordering', () => {
    it('should maintain FIFO order', async () => {
      const userIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      
      // Add users
      for (const userId of userIds) {
        await queueDS.addToQueue(testQueueName, userId);
      }

      // Pop users and verify order
      for (const expectedUserId of userIds) {
        const poppedUser = await queueDS.popNextUser(testQueueName);
        expect(poppedUser?.userId).toBe(expectedUserId);
      }

      // Queue should be empty
      const size = await queueDS.getQueueSize(testQueueName);
      expect(size).toBe(0);
    });
  });
});

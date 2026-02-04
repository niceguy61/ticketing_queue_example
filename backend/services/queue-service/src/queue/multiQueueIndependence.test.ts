import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import redisConnection from '../redis/connection';
import QueueDataStructure from './queueDataStructure';

/**
 * Property-based test for Multi-Queue Independence
 * Feature: ticketing-queue-system, Property 8: 다중 티켓 대기열 독립성
 * Validates: Requirements 6-2.5
 */

describe('Multi-Queue Independence Property Tests', () => {
  let queueDS: QueueDataStructure;

  beforeAll(async () => {
    await redisConnection.connect();
    queueDS = new QueueDataStructure();
  });

  afterAll(async () => {
    await redisConnection.disconnect();
  });

  beforeEach(async () => {
    // Clean up all test queues before each test
    const testQueues = ['test:ticket:event-1', 'test:ticket:event-2', 'test:ticket:event-3'];
    for (const queueName of testQueues) {
      await queueDS.clearQueue(queueName);
    }
  });

  it('should maintain independence when adding users to different queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate operations for two different queues
        fc.record({
          queue1Users: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
          queue2Users: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 })
        }),
        async ({ queue1Users, queue2Users }) => {
          const queue1Name = 'test:ticket:event-1';
          const queue2Name = 'test:ticket:event-2';

          try {
            // Add users to queue 1
            for (const userId of queue1Users) {
              await queueDS.addToQueue(queue1Name, userId, 'event-1');
            }

            // Get initial state of queue 1
            const queue1InitialSize = await queueDS.getQueueSize(queue1Name);
            const queue1InitialEntries = await queueDS.getQueueEntries(queue1Name);

            // Add users to queue 2
            for (const userId of queue2Users) {
              await queueDS.addToQueue(queue2Name, userId, 'event-2');
            }

            // Verify queue 1 state hasn't changed
            const queue1FinalSize = await queueDS.getQueueSize(queue1Name);
            const queue1FinalEntries = await queueDS.getQueueEntries(queue1Name);

            expect(queue1FinalSize).toBe(queue1InitialSize);
            expect(queue1FinalEntries.length).toBe(queue1InitialEntries.length);
            
            // Verify all original users are still in queue 1
            for (let i = 0; i < queue1InitialEntries.length; i++) {
              expect(queue1FinalEntries[i].userId).toBe(queue1InitialEntries[i].userId);
            }

            // Verify queue 2 has correct size
            const queue2Size = await queueDS.getQueueSize(queue2Name);
            expect(queue2Size).toBe(queue2Users.length);
          } finally {
            await queueDS.clearQueue(queue1Name);
            await queueDS.clearQueue(queue2Name);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should maintain independence when removing users from different queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          queue1Users: fc.array(fc.uuid(), { minLength: 2, maxLength: 15 }),
          queue2Users: fc.array(fc.uuid(), { minLength: 2, maxLength: 15 }),
          removeFromQueue2: fc.integer({ min: 0, max: 10 })
        }),
        async ({ queue1Users, queue2Users, removeFromQueue2 }) => {
          const queue1Name = 'test:ticket:event-1';
          const queue2Name = 'test:ticket:event-2';

          try {
            // Add users to both queues
            for (const userId of queue1Users) {
              await queueDS.addToQueue(queue1Name, userId, 'event-1');
            }
            for (const userId of queue2Users) {
              await queueDS.addToQueue(queue2Name, userId, 'event-2');
            }

            // Get initial state of queue 1
            const queue1InitialSize = await queueDS.getQueueSize(queue1Name);
            const queue1InitialEntries = await queueDS.getQueueEntries(queue1Name);

            // Remove users from queue 2
            const usersToRemove = Math.min(removeFromQueue2, queue2Users.length);
            for (let i = 0; i < usersToRemove; i++) {
              await queueDS.removeFromQueue(queue2Name, queue2Users[i]);
            }

            // Verify queue 1 state hasn't changed
            const queue1FinalSize = await queueDS.getQueueSize(queue1Name);
            const queue1FinalEntries = await queueDS.getQueueEntries(queue1Name);

            expect(queue1FinalSize).toBe(queue1InitialSize);
            expect(queue1FinalEntries.length).toBe(queue1InitialEntries.length);
            
            // Verify all users are still in queue 1 in same order
            for (let i = 0; i < queue1InitialEntries.length; i++) {
              expect(queue1FinalEntries[i].userId).toBe(queue1InitialEntries[i].userId);
            }

            // Verify queue 2 has correct size after removals
            const queue2FinalSize = await queueDS.getQueueSize(queue2Name);
            expect(queue2FinalSize).toBe(queue2Users.length - usersToRemove);
          } finally {
            await queueDS.clearQueue(queue1Name);
            await queueDS.clearQueue(queue2Name);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should maintain independence when processing users from different queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          queue1Users: fc.array(fc.uuid(), { minLength: 3, maxLength: 15 }),
          queue2Users: fc.array(fc.uuid(), { minLength: 3, maxLength: 15 }),
          processFromQueue2: fc.integer({ min: 1, max: 5 })
        }),
        async ({ queue1Users, queue2Users, processFromQueue2 }) => {
          const queue1Name = 'test:ticket:event-1';
          const queue2Name = 'test:ticket:event-2';

          try {
            // Add users to both queues
            for (const userId of queue1Users) {
              await queueDS.addToQueue(queue1Name, userId, 'event-1');
            }
            for (const userId of queue2Users) {
              await queueDS.addToQueue(queue2Name, userId, 'event-2');
            }

            // Get initial state of queue 1
            const queue1InitialSize = await queueDS.getQueueSize(queue1Name);
            const queue1InitialOrder = await queueDS.getQueueEntries(queue1Name);

            // Process users from queue 2 (pop)
            const usersToProcess = Math.min(processFromQueue2, queue2Users.length);
            for (let i = 0; i < usersToProcess; i++) {
              await queueDS.popNextUser(queue2Name);
            }

            // Verify queue 1 state hasn't changed
            const queue1FinalSize = await queueDS.getQueueSize(queue1Name);
            const queue1FinalOrder = await queueDS.getQueueEntries(queue1Name);

            expect(queue1FinalSize).toBe(queue1InitialSize);
            expect(queue1FinalOrder.length).toBe(queue1InitialOrder.length);
            
            // Verify FIFO order is maintained in queue 1
            for (let i = 0; i < queue1InitialOrder.length; i++) {
              expect(queue1FinalOrder[i].userId).toBe(queue1InitialOrder[i].userId);
            }

            // Verify queue 2 has correct size after processing
            const queue2FinalSize = await queueDS.getQueueSize(queue2Name);
            expect(queue2FinalSize).toBe(queue2Users.length - usersToProcess);
          } finally {
            await queueDS.clearQueue(queue1Name);
            await queueDS.clearQueue(queue2Name);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should maintain independence across three concurrent queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          queue1Users: fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          queue2Users: fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          queue3Users: fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          operationsOnQueue2: fc.integer({ min: 1, max: 5 })
        }),
        async ({ queue1Users, queue2Users, queue3Users, operationsOnQueue2 }) => {
          const queue1Name = 'test:ticket:event-1';
          const queue2Name = 'test:ticket:event-2';
          const queue3Name = 'test:ticket:event-3';

          try {
            // Add users to all three queues
            for (const userId of queue1Users) {
              await queueDS.addToQueue(queue1Name, userId, 'event-1');
            }
            for (const userId of queue2Users) {
              await queueDS.addToQueue(queue2Name, userId, 'event-2');
            }
            for (const userId of queue3Users) {
              await queueDS.addToQueue(queue3Name, userId, 'event-3');
            }

            // Get initial states of queue 1 and queue 3
            const queue1InitialSize = await queueDS.getQueueSize(queue1Name);
            const queue3InitialSize = await queueDS.getQueueSize(queue3Name);
            const queue1InitialEntries = await queueDS.getQueueEntries(queue1Name);
            const queue3InitialEntries = await queueDS.getQueueEntries(queue3Name);

            // Perform operations on queue 2 only
            const opsCount = Math.min(operationsOnQueue2, queue2Users.length);
            for (let i = 0; i < opsCount; i++) {
              await queueDS.popNextUser(queue2Name);
            }

            // Verify queue 1 and queue 3 states haven't changed
            const queue1FinalSize = await queueDS.getQueueSize(queue1Name);
            const queue3FinalSize = await queueDS.getQueueSize(queue3Name);
            const queue1FinalEntries = await queueDS.getQueueEntries(queue1Name);
            const queue3FinalEntries = await queueDS.getQueueEntries(queue3Name);

            // Queue 1 should be unchanged
            expect(queue1FinalSize).toBe(queue1InitialSize);
            expect(queue1FinalEntries.length).toBe(queue1InitialEntries.length);
            for (let i = 0; i < queue1InitialEntries.length; i++) {
              expect(queue1FinalEntries[i].userId).toBe(queue1InitialEntries[i].userId);
            }

            // Queue 3 should be unchanged
            expect(queue3FinalSize).toBe(queue3InitialSize);
            expect(queue3FinalEntries.length).toBe(queue3InitialEntries.length);
            for (let i = 0; i < queue3InitialEntries.length; i++) {
              expect(queue3FinalEntries[i].userId).toBe(queue3InitialEntries[i].userId);
            }

            // Queue 2 should have changed
            const queue2FinalSize = await queueDS.getQueueSize(queue2Name);
            expect(queue2FinalSize).toBe(queue2Users.length - opsCount);
          } finally {
            await queueDS.clearQueue(queue1Name);
            await queueDS.clearQueue(queue2Name);
            await queueDS.clearQueue(queue3Name);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('should maintain position independence across queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate completely separate user sets for each queue
          queue1Users: fc.uniqueArray(fc.uuid(), { minLength: 3, maxLength: 10 }),
          queue2Users: fc.uniqueArray(fc.uuid(), { minLength: 3, maxLength: 10 })
        }).chain(({ queue1Users, queue2Users }) => {
          // Ensure no overlap between queues by filtering
          const filteredQueue2 = queue2Users.filter(id => !queue1Users.includes(id));
          // If filtering removed too many, skip this test case
          if (filteredQueue2.length < 2) {
            return fc.constant({ queue1Users, queue2Users: queue2Users });
          }
          return fc.constant({ queue1Users, queue2Users: filteredQueue2 });
        }),
        async ({ queue1Users, queue2Users }) => {
          const queue1Name = 'test:ticket:event-1';
          const queue2Name = 'test:ticket:event-2';

          // Skip if we don't have enough unique users
          if (queue1Users.length < 2 || queue2Users.length < 2) {
            return;
          }

          try {
            // Add users to queue 1
            for (const userId of queue1Users) {
              await queueDS.addToQueue(queue1Name, userId, 'event-1');
            }

            // Get initial state of queue 1
            const queue1InitialSize = await queueDS.getQueueSize(queue1Name);
            const queue1InitialEntries = await queueDS.getQueueEntries(queue1Name);

            // Add users to queue 2
            for (const userId of queue2Users) {
              await queueDS.addToQueue(queue2Name, userId, 'event-2');
            }

            // Verify queue 1 state hasn't changed
            const queue1FinalSize = await queueDS.getQueueSize(queue1Name);
            const queue1FinalEntries = await queueDS.getQueueEntries(queue1Name);

            expect(queue1FinalSize).toBe(queue1InitialSize);
            expect(queue1FinalEntries.length).toBe(queue1InitialEntries.length);
            
            // Verify all users are still in queue 1 in same order
            for (let i = 0; i < queue1InitialEntries.length; i++) {
              expect(queue1FinalEntries[i].userId).toBe(queue1InitialEntries[i].userId);
            }

            // Verify queue 2 has correct size
            const queue2Size = await queueDS.getQueueSize(queue2Name);
            expect(queue2Size).toBe(queue2Users.length);
          } finally {
            await queueDS.clearQueue(queue1Name);
            await queueDS.clearQueue(queue2Name);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

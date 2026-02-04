import { QueueAdapter, QueueAdapterConfig, MessageHandler } from './types';
import redisConnection from '../redis/connection';
import logger from '../utils/logger';

/**
 * Redis 기반 간단한 Message Queue Adapter
 * Redis List를 사용하여 메시지 큐 기능 구현
 */
export class RedisAdapter implements QueueAdapter {
  private isConnected: boolean = false;
  private subscriptions: Map<string, NodeJS.Timeout> = new Map();
  private readonly pollIntervalMs: number;

  constructor(config?: QueueAdapterConfig) {
    this.pollIntervalMs = config?.pollIntervalMs || 1000;
  }

  async connect(): Promise<void> {
    // Redis 연결은 redisConnection에서 관리
    this.isConnected = redisConnection.isConnectionHealthy();
    if (!this.isConnected) {
      throw new Error('Redis is not connected');
    }
    logger.info('Redis Queue Adapter connected');
  }

  async disconnect(): Promise<void> {
    // 모든 구독 중지
    for (const [queueName, interval] of this.subscriptions.entries()) {
      clearInterval(interval);
      logger.info('Stopped subscription', { queueName });
    }
    this.subscriptions.clear();
    this.isConnected = false;
    logger.info('Redis Queue Adapter disconnected');
  }

  async publish(queueName: string, message: Record<string, unknown>): Promise<void> {
    const client = redisConnection.getClient();
    const messageStr = JSON.stringify({
      ...message,
      _publishedAt: Date.now()
    });
    
    await client.rPush(`mq:${queueName}`, messageStr);
    logger.debug('Message published to Redis queue', { queueName });
  }

  async subscribe(
    queueName: string,
    handler: MessageHandler
  ): Promise<void> {
    const client = redisConnection.getClient();
    const redisQueueName = `mq:${queueName}`;

    // 폴링 방식으로 메시지 처리
    const pollInterval = setInterval(async () => {
      try {
        const messageStr = await client.lPop(redisQueueName);
        
        if (messageStr) {
          const message = JSON.parse(messageStr);
          
          const ack = async () => {
            // Redis List에서 이미 제거됨 (lPop)
            logger.debug('Message acknowledged', { queueName });
          };

          const nack = async () => {
            // 실패 시 재시도 카운트 증가 후 다시 큐에 추가 (맨 뒤에)
            const retryMessage = {
              ...message,
              _retryCount: (message._retryCount || 0) + 1
            };
            await client.rPush(redisQueueName, JSON.stringify(retryMessage));
            logger.debug('Message nacked, re-queued with retry count', { 
              queueName, 
              retryCount: retryMessage._retryCount 
            });
          };

          await handler(message, ack, nack);
        }
      } catch (error) {
        logger.error('Error processing message from Redis queue', {
          queueName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.pollIntervalMs);

    this.subscriptions.set(queueName, pollInterval);
    logger.info('Subscribed to Redis queue', { queueName, pollIntervalMs: this.pollIntervalMs });
  }

  async unsubscribe(queueName: string): Promise<void> {
    const interval = this.subscriptions.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.subscriptions.delete(queueName);
      logger.info('Unsubscribed from Redis queue', { queueName });
    }
  }

  async getQueueSize(queueName: string): Promise<number> {
    const client = redisConnection.getClient();
    return await client.lLen(`mq:${queueName}`);
  }

  isHealthy(): boolean {
    return this.isConnected && redisConnection.isConnectionHealthy();
  }
}

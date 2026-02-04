import { QueueAdapter, QueueAdapterConfig } from './types';
import { SQSAdapter } from './sqsAdapter';
import { RedisAdapter } from './redisAdapter';
import { RabbitMQAdapter } from './rabbitmqAdapter';
import { KafkaAdapter } from './kafkaAdapter';
import logger from '../utils/logger';

/**
 * Queue Adapter 팩토리
 * 환경 변수에 따라 적절한 Queue Adapter 구현체를 생성합니다.
 */
export class QueueAdapterFactory {
  /**
   * Queue Adapter 생성
   * @param provider 큐 제공자 (sqs, rabbitmq, kafka, redis)
   * @param config 어댑터 설정
   * @returns QueueAdapter 인스턴스
   */
  static create(provider?: string, config?: QueueAdapterConfig): QueueAdapter {
    const queueProvider = provider || process.env.QUEUE_PROVIDER || 'sqs';

    logger.info('Creating Queue Adapter', { provider: queueProvider });

    switch (queueProvider.toLowerCase()) {
      case 'sqs':
        return new SQSAdapter(config);

      case 'rabbitmq':
        return new RabbitMQAdapter(config);

      case 'kafka':
        return new KafkaAdapter(config);

      case 'redis':
        return new RedisAdapter(config);

      default:
        throw new Error(`Unsupported queue provider: ${queueProvider}`);
    }
  }
}
